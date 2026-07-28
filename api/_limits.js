// Shared limit helpers for the demo endpoints.
//
// There are three layers, deliberately, because none of them alone is enough:
//
//   1. Signed session token (stateless) — tracks turns within one conversation.
//   2. httpOnly cookie — carries that token so a plain page refresh doesn't
//      reset the count. JS can't read or clear an httpOnly cookie, so this
//      handles the casual "just reload it" case with no infrastructure.
//   3. Per-IP counter in Upstash Redis, over a rolling 3-day window — the only
//      layer that survives incognito / cleared storage.
//
// None of this stops a determined person with a VPN; short of real accounts,
// nothing does. The hard backstop is a spend limit set on the API key itself in
// the Anthropic Console. Layers 1 and 2 always work; layer 3 activates only
// when the Upstash env vars are present, and fails OPEN (allows the request) if
// the store is unreachable — a demo that breaks because Redis blipped is worse
// than one that briefly over-serves.

import crypto from "node:crypto";

export const IP_WINDOW_DAYS = 3;
export const IP_TURN_CAP = 60; // total model calls per IP per 3-day window
const IP_WINDOW_SECONDS = IP_WINDOW_DAYS * 24 * 60 * 60;

const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6h — long enough for a sitting
export const COOKIE_NAME = "ucl_sess";

function secret() {
  const s = process.env.CHAT_SESSION_SECRET;
  if (!s) throw new Error("CHAT_SESSION_SECRET is not set");
  return s;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

// ---------------------------------------------------------------------------
// Session token: base64url("<turns>.<agentId>.<expiry>") + "." + hmac
// ---------------------------------------------------------------------------

export function encodeToken(turns, agentId) {
  const expiry = Date.now() + SESSION_TTL_MS;
  const encoded = Buffer.from(`${turns}.${agentId}.${expiry}`, "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function decodeToken(token) {
  const empty = { turns: 0, agentId: null };
  try {
    const [encoded, sig] = String(token ?? "").split(".");
    if (!encoded || !sig) return empty;

    const expected = sign(encoded);
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return empty;

    const [turnsStr, agentId, expiryStr] = Buffer.from(encoded, "base64url")
      .toString("utf8")
      .split(".");
    const turns = parseInt(turnsStr, 10);
    const expiry = parseInt(expiryStr, 10);
    if (!Number.isFinite(turns) || !Number.isFinite(expiry)) return empty;
    if (Date.now() > expiry) return empty;

    return { turns, agentId: agentId || null };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Cookie plumbing
// ---------------------------------------------------------------------------

export function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function setSessionCookie(res, value) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`,
  );
}

// Prefer the cookie over the request body: the body is client-controlled and
// trivially reset by reloading the page, the httpOnly cookie is not. Take
// whichever shows MORE turns used so neither path can be used to rewind.
export function resolveTurns(req, bodyToken) {
  const fromCookie = decodeToken(readCookie(req, COOKIE_NAME));
  const fromBody = decodeToken(bodyToken);
  return fromCookie.turns >= fromBody.turns ? fromCookie : fromBody;
}

// ---------------------------------------------------------------------------
// Per-IP cap (Upstash Redis REST — optional)
// ---------------------------------------------------------------------------

function upstashConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export function clientIp(req) {
  const fwd = req.headers?.["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length) return String(fwd[0]).split(",")[0].trim();
  return req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

// Hash the IP so we're not storing raw addresses.
function ipKey(ip) {
  const digest = crypto.createHmac("sha256", secret()).update(ip).digest("hex").slice(0, 32);
  return `ucl:ip:${digest}`;
}

async function upstash(command) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}

/**
 * Increment this IP's usage and report whether it's over the cap.
 * Fails open — if Upstash isn't configured or is unreachable, the request is
 * allowed and `enforced` is false.
 */
export async function checkAndCountIp(req) {
  if (!upstashConfigured()) return { allowed: true, enforced: false, used: 0, cap: IP_TURN_CAP };

  const key = ipKey(clientIp(req));
  try {
    const { result: used } = await upstash(["INCR", key]);
    // Set the window only when this is the first hit, so it's a fixed 3-day
    // window from first use rather than one that slides forever with activity.
    if (used === 1) await upstash(["EXPIRE", key, String(IP_WINDOW_SECONDS)]);
    return { allowed: used <= IP_TURN_CAP, enforced: true, used, cap: IP_TURN_CAP };
  } catch (err) {
    console.warn("IP cap check failed, allowing request:", err.message);
    return { allowed: true, enforced: false, used: 0, cap: IP_TURN_CAP };
  }
}
