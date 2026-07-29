// Shared-password gate for the demo.
//
//   GET  /api/auth  -> { gateEnabled, unlocked }  (lets the UI decide what to show)
//   POST /api/auth  -> { unlocked: true } + sets the gate cookie, or 401
//
// The password is never sent back to the client, and the cookie stores a
// signature of it rather than the value, so rotating DEMO_PASSWORD invalidates
// every previously issued cookie.

import {
  gateEnabled,
  isUnlocked,
  checkPassword,
  setGateCookie,
  clientIp,
  capsEnforced,
  peekDailyUsage,
} from "./_limits.js";

// Crude in-memory throttle to make guessing tedious. Serverless instances are
// ephemeral and not shared, so this is a speed bump rather than a real defence —
// the actual protection is that the password isn't guessable. Generate a long
// random one; don't pick a word.
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;

function tooManyAttempts(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { first: now, count: 1 });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    // `capsEnforced` is a deployment health signal, not something the UI uses:
    // the spend caps fail open by design, so without a way to see whether the
    // Redis credentials actually resolved, a silently-unenforced cap looks
    // exactly like a working one.
    const unlocked = isUnlocked(req);
    // Today's usage is only disclosed to someone who's already past the gate,
    // so it isn't a free readout of the demo's traffic for anyone who finds it.
    const usage = unlocked ? await peekDailyUsage() : undefined;
    res.status(200).json({
      gateEnabled: gateEnabled(),
      unlocked,
      capsEnforced: capsEnforced(),
      ...(usage ? { usage } : {}),
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!gateEnabled()) {
    res.status(200).json({ unlocked: true });
    return;
  }

  if (tooManyAttempts(clientIp(req))) {
    res.status(429).json({ error: "Too many attempts. Please wait a few minutes." });
    return;
  }

  const { password } = req.body ?? {};
  if (!checkPassword(password)) {
    res.status(401).json({ error: "That password isn't right." });
    return;
  }

  setGateCookie(res);
  res.status(200).json({ unlocked: true });
}
