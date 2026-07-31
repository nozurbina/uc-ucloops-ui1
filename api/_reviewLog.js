// Retained transcripts, so submissions can actually be reviewed.
//
// This is the mechanism behind the acknowledgement gate's "retained for up to 30
// days and then deleted". The deletion is structural, not a promise someone has to
// remember to keep: every write re-applies a 30-day EXPIRE, so a record disappears
// on its own 30 days after the last turn. Nothing has to run for that to happen.
//
// Deliberately NOT email. Emailing transcripts and attachments would put copies in
// a mailbox the app can't reach, which would make the 30-day claim false the moment
// the first one landed. A digest email links here instead.
//
// Fails open, like the spend caps: if Redis is unreachable the turn still serves.
// Losing a review record is not worth failing a user's request over.

import { redisAvailable, redisCommand } from "./_limits.js";

export const RETENTION_DAYS = 30;
const RETENTION_SECONDS = RETENTION_DAYS * 24 * 60 * 60;

const recordKey = (id) => `ucl:review:${id}`;
const INDEX_KEY = "ucl:review:index";

// Truncate defensively. A transcript is the point, but a pasted 1MB document would
// blow the Redis value limit and lose the whole record — better a marked-truncated
// record than none.
const MAX_TEXT = 20_000;
function clip(text) {
  const s = String(text ?? "");
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}\n\n[…truncated for review storage]` : s;
}

/**
 * Append one exchange to a conversation's review record, creating it if needed.
 *
 * `conversationId` comes from the client and is treated as untrusted: it only ever
 * lands inside a key name, and it's sanitised to a short hex-ish string so a
 * crafted value can't reach another key.
 */
export async function recordTurn({
  conversationId,
  agentId,
  userText,
  assistantText,
  attachments = [],
  nowMs,
}) {
  if (!redisAvailable()) return { recorded: false, reason: "redis-not-configured" };

  const id = String(conversationId ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  if (!id) return { recorded: false, reason: "no-conversation-id" };

  const at = nowMs ?? Date.now();
  const key = recordKey(id);

  try {
    const { result: existing } = await redisCommand(["GET", key]);
    const record = existing
      ? JSON.parse(existing)
      : { id, agentId, startedAt: at, turns: 0, messages: [], attachments: [] };

    record.turns += 1;
    record.lastTurnAt = at;
    record.agentId = agentId ?? record.agentId;
    record.messages.push({ role: "user", text: clip(userText), at });
    if (assistantText != null) {
      record.messages.push({ role: "assistant", text: clip(assistantText), at });
    }

    // File bytes are never copied here — only the Anthropic file_id, which the
    // daily sweep uses to delete the file itself. Reviewing an attachment means
    // fetching it from Anthropic, not from our own store.
    for (const att of attachments) {
      if (!record.attachments.some((a) => a.fileId === att.fileId)) {
        record.attachments.push({
          fileId: att.fileId,
          filename: att.filename,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          at,
        });
      }
    }

    await redisCommand(["SET", key, JSON.stringify(record)]);
    // Re-applied every turn, so the window runs from the last activity rather than
    // expiring a live conversation mid-way.
    await redisCommand(["EXPIRE", key, String(RETENTION_SECONDS)]);
    // Score is the timestamp, so the review page can list newest-first and the
    // sweep can drop index entries whose records have already expired.
    await redisCommand(["ZADD", INDEX_KEY, String(at), id]);

    return { recorded: true, turns: record.turns };
  } catch (err) {
    console.warn("review log write failed, continuing:", err.message);
    return { recorded: false, reason: err.message };
  }
}

/** Newest-first summaries for the review page. */
export async function listRecords({ limit = 100 } = {}) {
  if (!redisAvailable()) return { available: false, records: [] };
  try {
    const { result: ids } = await redisCommand([
      "ZRANGE",
      INDEX_KEY,
      "0",
      String(Math.max(0, limit - 1)),
      "REV",
    ]);
    const records = [];
    for (const id of ids ?? []) {
      const { result: raw } = await redisCommand(["GET", recordKey(id)]);
      // A missing record means it aged out; the sweep prunes the index entry.
      if (raw) records.push(JSON.parse(raw));
    }
    return { available: true, records };
  } catch (err) {
    return { available: true, records: [], error: err.message };
  }
}

export async function getRecord(id) {
  if (!redisAvailable()) return null;
  const safe = String(id ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  if (!safe) return null;
  try {
    const { result: raw } = await redisCommand(["GET", recordKey(safe)]);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Drop index entries older than the retention window (their records are already gone). */
export async function pruneIndex(nowMs) {
  if (!redisAvailable()) return { pruned: 0 };
  const cutoff = (nowMs ?? Date.now()) - RETENTION_SECONDS * 1000;
  try {
    const { result } = await redisCommand([
      "ZREMRANGEBYSCORE",
      INDEX_KEY,
      "-inf",
      String(cutoff),
    ]);
    return { pruned: Number(result) || 0 };
  } catch (err) {
    return { pruned: 0, error: err.message };
  }
}

/** Every attachment file_id still referenced by a live record. */
export async function referencedFileIds() {
  const { records } = await listRecords({ limit: 500 });
  return new Set(records.flatMap((r) => (r.attachments ?? []).map((a) => a.fileId)));
}
