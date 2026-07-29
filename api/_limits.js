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

// Global ceiling on model calls per calendar day (UTC), across every visitor.
// This is the cost backstop that doesn't depend on any provider-side spend
// limit: whatever else happens, the demo cannot make more than this many calls
// in a day. At Haiku rates a call averages roughly 2-3 cents, so the default
// bounds a day at single-digit dollars. Override with DEMO_DAILY_CALL_CAP.
export const DAILY_CALL_CAP = Number(process.env.DEMO_DAILY_CALL_CAP) || 300;

const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6h — long enough for a sitting
export const COOKIE_NAME = "ucl_sess";

const GATE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — type it once
export const GATE_COOKIE_NAME = "ucl_gate";

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

// Append rather than assign: a single response may need to set both the gate
// cookie and the session cookie, and res.setHeader("Set-Cookie", ...) replaces
// any value already there, silently dropping one of them.
function appendCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", [cookie]);
  else res.setHeader("Set-Cookie", [...[].concat(existing), cookie]);
}

export function setSessionCookie(res, value) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  appendCookie(
    res,
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
// Shared-password gate
// ---------------------------------------------------------------------------
//
// A single password shared with whoever should be able to try the demo. The
// point is not to be unbreakable — anyone holding the password can pass it on —
// it's to stop automated scanners, which is the realistic threat to an
// unauthenticated endpoint that proxies a paid model.
//
// If DEMO_PASSWORD isn't set the gate is OFF, so local development and any
// existing deployment keep working unchanged.

export function gateEnabled() {
  return Boolean(process.env.DEMO_PASSWORD);
}

// The cookie holds a signature of the password rather than the password itself,
// so a stolen cookie can't be turned back into the shared secret, and rotating
// DEMO_PASSWORD invalidates every issued cookie automatically.
function gateValue() {
  return sign(`gate:${process.env.DEMO_PASSWORD}`);
}

export function checkPassword(candidate) {
  if (!gateEnabled()) return true;
  const a = Buffer.from(String(candidate ?? ""), "utf8");
  const b = Buffer.from(String(process.env.DEMO_PASSWORD), "utf8");
  // Length check first: timingSafeEqual throws on a length mismatch.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isUnlocked(req) {
  if (!gateEnabled()) return true;
  const cookie = readCookie(req, GATE_COOKIE_NAME);
  if (!cookie) return false;
  const a = Buffer.from(cookie, "utf8");
  const b = Buffer.from(gateValue(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function setGateCookie(res) {
  const maxAge = Math.floor(GATE_TTL_MS / 1000);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  appendCookie(
    res,
    `${GATE_COOKIE_NAME}=${encodeURIComponent(gateValue())}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${maxAge}`,
  );
}

/**
 * Guard for the protected endpoints. Returns true if the request may proceed;
 * otherwise writes a 401 and returns false.
 */
export function requireUnlocked(req, res) {
  if (isUnlocked(req)) return true;
  res.status(401).json({ error: "locked", locked: true });
  return false;
}

// ---------------------------------------------------------------------------
// Per-IP cap (Upstash Redis REST — optional)
// ---------------------------------------------------------------------------

// Two naming conventions in the wild, so accept both:
//   UPSTASH_REDIS_REST_*  — what Upstash uses when you provision directly
//   KV_REST_API_*         — what Vercel's Upstash Marketplace integration injects
// Note KV_REST_API_READ_ONLY_TOKEN is deliberately NOT a fallback: the counters
// need INCR, so a read-only token would fail every write.
function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function upstashConfigured() {
  return Boolean(redisConfig());
}

/** Whether the spend caps can actually enforce (i.e. Redis credentials resolved). */
export function capsEnforced() {
  return upstashConfigured();
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
  const cfg = redisConfig();
  if (!cfg) throw new Error("Redis not configured");
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
}

/**
 * Global daily ceiling on model calls, shared across all visitors.
 *
 * Uses a fixed UTC-day bucket rather than a rolling window so that "try again
 * tomorrow" is literally true — a rolling window would trickle capacity back in
 * unpredictably and make the message a lie.
 *
 * Fails open, like the per-IP cap: an outage shouldn't take the demo down.
 */
export async function checkAndCountDaily() {
  if (!upstashConfigured()) {
    return { allowed: true, enforced: false, used: 0, cap: DAILY_CALL_CAP };
  }

  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  const key = `ucl:daily:${day}`;
  try {
    const { result: used } = await upstash(["INCR", key]);
    // 48h TTL: comfortably past the day's end, and self-cleaning.
    if (used === 1) await upstash(["EXPIRE", key, "172800"]);
    return { allowed: used <= DAILY_CALL_CAP, enforced: true, used, cap: DAILY_CALL_CAP };
  } catch (err) {
    console.warn("Daily cap check failed, allowing request:", err.message);
    return { allowed: true, enforced: false, used: 0, cap: DAILY_CALL_CAP };
  }
}

/**
 * Read today's usage without incrementing it — for the status readout in
 * /api/auth. Uses GET rather than INCR so checking the number never changes it.
 */
export async function peekDailyUsage() {
  if (!upstashConfigured()) return { enforced: false, used: null, cap: DAILY_CALL_CAP };
  const day = new Date().toISOString().slice(0, 10);
  try {
    const { result } = await upstash(["GET", `ucl:daily:${day}`]);
    return { enforced: true, used: Number(result) || 0, cap: DAILY_CALL_CAP, day };
  } catch (err) {
    // Credentials present but Redis unreachable — worth distinguishing from
    // "not configured", since this is the case where caps silently don't work.
    return { enforced: true, used: null, cap: DAILY_CALL_CAP, error: err.message };
  }
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
