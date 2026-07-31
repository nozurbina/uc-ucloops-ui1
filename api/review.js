// Password-gated review page for retained submissions.
//
// Server-rendered HTML rather than a client route: this is an internal tool, it
// must never be reachable from the demo's bundle, and rendering it here keeps the
// transcripts out of the public JS entirely.
//
// Auth is a dedicated REVIEW_PASSWORD, deliberately NOT the demo's DEMO_PASSWORD —
// that one is shared with prospects, and it must not also unlock other visitors'
// transcripts. With REVIEW_PASSWORD unset the endpoint is closed, not open.

import { getRecord, listRecords, RETENTION_DAYS } from "./_reviewLog.js";
import { redisAvailable } from "./_limits.js";

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function authorised(req) {
  const expected = process.env.REVIEW_PASSWORD;
  // Closed by default: no password configured means no access, rather than an
  // unauthenticated transcript dump.
  if (!expected) return false;
  const supplied = req.query?.key ?? "";
  return typeof supplied === "string" && supplied.length > 0 && supplied === expected;
}

const STYLE = `
  body{font-family:'Inter',-apple-system,'Segoe UI',sans-serif;margin:0;background:#f5f5f5;color:#1a1a1a}
  header{background:#2c3e50;color:#fff;padding:1rem 1.5rem}
  header h1{margin:0;font-size:1.05rem}
  header p{margin:.25rem 0 0;font-size:.8rem;color:rgba(255,255,255,.7)}
  main{padding:1.5rem;max-width:60rem;margin:0 auto}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}
  th,td{text-align:left;padding:.6rem .8rem;font-size:.84rem;border-bottom:1px solid #eee}
  th{background:#fdf8ee;font-weight:700;color:#7a5c0a}
  tr:last-child td{border-bottom:none}
  a{color:#750675}
  .msg{background:#fff;border-radius:10px;padding:1rem 1.1rem;margin:0 0 .7rem}
  .msg.user{border-left:3px solid #750675}
  .msg.assistant{border-left:3px solid #d7a32b}
  .role{font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin-bottom:.4rem}
  pre{white-space:pre-wrap;word-wrap:break-word;margin:0;font:inherit}
  .empty{background:#fff;border-radius:10px;padding:2rem;text-align:center;color:#667085}
`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title><style>${STYLE}</style></head><body>
<header><h1>ucLoops demo — submission review</h1>
<p>Retained ${RETENTION_DAYS} days, then deleted automatically. Internal use only.</p></header>
<main>${body}</main></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  if (!authorised(req)) {
    // Same response whether the password is wrong or unset — no oracle for
    // whether the endpoint is configured.
    res.status(404).send("Not found");
    return;
  }

  if (!redisAvailable()) {
    res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(
        page(
          "Review",
          `<div class="empty">Redis isn't configured, so nothing is being retained.
           Set <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code>.</div>`,
        ),
      );
    return;
  }

  const key = encodeURIComponent(req.query.key);

  // Single transcript
  if (req.query.id) {
    const record = await getRecord(req.query.id);
    if (!record) {
      res
        .status(200)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(
          page(
            "Review",
            `<p><a href="/api/review?key=${key}">&larr; All sessions</a></p>
             <div class="empty">That record has expired or never existed.</div>`,
          ),
        );
      return;
    }
    const atts = (record.attachments ?? [])
      .map(
        (a) =>
          `<li>${esc(a.filename)} <span style="color:#667085">(${esc(a.mimeType)},
           ${Math.round((a.sizeBytes ?? 0) / 1024)}KB) — Anthropic file_id
           <code>${esc(a.fileId)}</code></span></li>`,
      )
      .join("");
    const body = `
      <p><a href="/api/review?key=${key}">&larr; All sessions</a></p>
      <table style="margin-bottom:1.2rem"><tr><th>Agent</th><td>${esc(record.agentId)}</td></tr>
      <tr><th>Turns</th><td>${record.turns}</td></tr>
      <tr><th>Started</th><td>${esc(new Date(record.startedAt).toISOString())}</td></tr>
      <tr><th>Last turn</th><td>${esc(new Date(record.lastTurnAt ?? record.startedAt).toISOString())}</td></tr></table>
      ${atts ? `<h2 style="font-size:.95rem">Attachments</h2><ul>${atts}</ul>` : ""}
      <h2 style="font-size:.95rem">Transcript</h2>
      ${(record.messages ?? [])
        .map(
          (m) =>
            `<div class="msg ${m.role === "user" ? "user" : "assistant"}">
               <div class="role">${esc(m.role)}</div><pre>${esc(m.text)}</pre></div>`,
        )
        .join("")}`;
    res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(page(`Review — ${record.agentId}`, body));
    return;
  }

  // Index
  const { records } = await listRecords({ limit: 200 });
  if (!records.length) {
    res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(page("Review", `<div class="empty">No sessions retained right now.</div>`));
    return;
  }
  const rows = records
    .map(
      (r) => `<tr>
        <td><a href="/api/review?key=${key}&id=${encodeURIComponent(r.id)}">${esc(r.agentId)}</a></td>
        <td>${r.turns}</td>
        <td>${(r.attachments ?? []).length}</td>
        <td>${esc(new Date(r.lastTurnAt ?? r.startedAt).toISOString().slice(0, 16).replace("T", " "))}</td>
      </tr>`,
    )
    .join("");
  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(
      page(
        "Review",
        `<p style="font-size:.84rem;color:#667085">${records.length} retained session(s),
         newest first.</p>
         <table><tr><th>Agent</th><th>Turns</th><th>Files</th><th>Last turn (UTC)</th></tr>
         ${rows}</table>`,
      ),
    );
}
