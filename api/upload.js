// Uploads one research attachment to the Anthropic Files API and returns its
// file_id. The chat endpoint then references that id instead of re-embedding
// the file's bytes in every request.
//
// Why go through the Files API rather than base64 in the chat payload:
//   - Vercel caps a function request body at ~4.5MB and base64 inflates ~33%,
//     so embedding even one large file is fragile.
//   - The Messages API is stateless: an embedded file is re-sent (and re-billed)
//     on every single turn. Referencing a file_id keeps long conversations cheap.

import Anthropic from "@anthropic-ai/sdk";
import { checkAndCountIp, requireUnlocked } from "./_limits.js";

export const MAX_FILE_BYTES = 1024 * 1024; // 1MB per file
export const MAX_FILES = 3;

// What the Messages API accepts once the file is referenced by file_id:
// document blocks take PDF or text/plain ONLY, and image blocks take the four
// common raster types. Markdown and CSV are plaintext, so they're uploaded as
// text/plain — uploading them as text/markdown succeeds but then gets rejected
// at message time with "Unsupported document file format".
const EXT_TO_MIME = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/plain",
  markdown: "text/plain",
  csv: "text/plain",
  json: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const PASSTHROUGH_MIME = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

// Prefer the extension: browsers report .md as text/markdown and .csv as
// text/csv, neither of which the document block will take.
function resolveMime(name, provided) {
  const ext = String(name ?? "").toLowerCase().split(".").pop();
  if (EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  if (provided && PASSTHROUGH_MIME.has(provided)) return provided;
  if (provided && provided.startsWith("text/")) return "text/plain";
  return null;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Password gate — no unauthenticated uploads into our Files API account.
  if (!requireUnlocked(req, res)) return;

  try {
    const ipCheck = await checkAndCountIp(req);
    if (!ipCheck.allowed) {
      res.status(429).json({
        error: "You've reached the usage limit for this demo. Please try again in a few days.",
      });
      return;
    }

    const { filename, mimeType, dataBase64 } = req.body ?? {};

    if (typeof dataBase64 !== "string" || !dataBase64.length) {
      res.status(400).json({ error: "dataBase64 is required" });
      return;
    }

    const buffer = Buffer.from(dataBase64, "base64");
    if (!buffer.length) {
      res.status(400).json({ error: "Attachment appears to be empty or invalid" });
      return;
    }
    if (buffer.length > MAX_FILE_BYTES) {
      res.status(413).json({
        error: `Attachments are limited to 1MB each in this demo (this one is ${(buffer.length / 1024 / 1024).toFixed(1)}MB).`,
      });
      return;
    }

    const safeName = String(filename ?? "attachment").slice(0, 200);
    const resolved = resolveMime(safeName, mimeType);
    if (!resolved) {
      res.status(415).json({
        error: "Unsupported file type. Use PDF, text, markdown, CSV, or an image.",
      });
      return;
    }

    const uploaded = await anthropic.beta.files.upload({
      file: new File([buffer], safeName, { type: resolved }),
      betas: ["files-api-2025-04-14"],
    });

    // `kind` tells the chat endpoint which content-block shape to use, since
    // the block type has to match the file's media type.
    res.status(200).json({
      fileId: uploaded.id,
      filename: safeName,
      mimeType: resolved,
      kind: resolved.startsWith("image/") ? "image" : "document",
      sizeBytes: buffer.length,
    });
  } catch (err) {
    console.error("upload handler error:", err);
    if (err?.status === 429) {
      res.status(429).json({ error: "Rate limited, please wait and try again." });
      return;
    }
    res.status(500).json({ error: "Upload failed. Please try a smaller or different file." });
  }
}
