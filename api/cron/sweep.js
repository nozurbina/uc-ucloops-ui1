// Daily retention sweep — the half of "deleted after 30 days" that isn't automatic.
//
// Review records expire on their own (every write re-applies a 30-day EXPIRE), so
// this doesn't touch them except to prune index entries whose records have already
// gone. What it does own is the Anthropic side: files uploaded via the Files API
// persist until explicitly deleted, so without this the attachment copy would
// outlive the retention promise indefinitely.
//
// Also sends the digest email, if an email provider is configured. The digest links
// to the review page rather than carrying transcripts, so no copy of a submission
// ends up in a mailbox the retention window can't reach.

import Anthropic from "@anthropic-ai/sdk";
import { pruneIndex, listRecords, RETENTION_DAYS } from "../_reviewLog.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Vercel signs cron invocations with CRON_SECRET. Without it the endpoint would be
 * a public "delete my files" button, so an unverified request is refused rather
 * than trusted.
 */
function authorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers?.authorization === `Bearer ${secret}`;
}

async function deleteExpiredFiles(nowMs) {
  const cutoff = nowMs - RETENTION_MS;
  const deleted = [];
  const failed = [];

  // Everything in the account, not just what the review log knows about: a file
  // uploaded during a conversation that was never sent still needs deleting, and
  // that's exactly the orphan a record-driven sweep would miss.
  for await (const file of anthropic.beta.files.list({ betas: ["files-api-2025-04-14"] })) {
    const createdMs = Date.parse(file.created_at);
    if (!Number.isFinite(createdMs) || createdMs > cutoff) continue;
    try {
      await anthropic.beta.files.delete(file.id, { betas: ["files-api-2025-04-14"] });
      deleted.push(file.id);
    } catch (err) {
      failed.push({ id: file.id, error: err.message });
    }
  }
  return { deleted, failed };
}

async function sendDigest({ records, baseUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REVIEW_DIGEST_TO;
  if (!apiKey || !to) return { sent: false, reason: "email-not-configured" };

  const day = 24 * 60 * 60 * 1000;
  const since = Date.now() - day;
  const fresh = records.filter((r) => (r.lastTurnAt ?? r.startedAt) >= since);
  if (!fresh.length) return { sent: false, reason: "nothing-new" };

  const withFiles = fresh.filter((r) => (r.attachments ?? []).length).length;
  const lines = fresh
    .map((r) => `- ${r.agentId}: ${r.turns} turn(s)${(r.attachments ?? []).length ? " · has attachments" : ""}`)
    .join("\n");

  // Deliberately no transcript content and no attachments — a link only. See the
  // module header.
  const text = `${fresh.length} ucLoops demo session(s) in the last 24h${
    withFiles ? `, ${withFiles} with attachments` : ""
  }.

${lines}

Review them: ${baseUrl}/api/review?key=<REVIEW_PASSWORD>

Sessions are deleted automatically ${RETENTION_DAYS} days after their last turn.`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REVIEW_DIGEST_FROM || "ucLoops demo <onboarding@resend.dev>",
        to: [to],
        subject: `ucLoops demo — ${fresh.length} session(s) yesterday`,
        text,
      }),
    });
    if (!res.ok) return { sent: false, reason: `resend ${res.status}: ${await res.text()}` };
    return { sent: true, sessions: fresh.length };
  } catch (err) {
    return { sent: false, reason: err.message };
  }
}

export default async function handler(req, res) {
  if (!authorised(req)) {
    res.status(404).send("Not found");
    return;
  }

  const now = Date.now();
  const files = await deleteExpiredFiles(now);
  const index = await pruneIndex(now);
  const { records } = await listRecords({ limit: 500 });
  const proto = req.headers["x-forwarded-proto"] || "https";
  const digest = await sendDigest({
    records,
    baseUrl: `${proto}://${req.headers.host}`,
  });

  console.log("retention sweep:", JSON.stringify({ files, index, digest }));
  res.status(200).json({
    retentionDays: RETENTION_DAYS,
    filesDeleted: files.deleted.length,
    fileFailures: files.failed,
    indexPruned: index.pruned,
    liveRecords: records.length,
    digest,
  });
}
