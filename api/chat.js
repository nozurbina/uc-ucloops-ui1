import Anthropic from "@anthropic-ai/sdk";
import { getAgent } from "../src/agents.js";
import { skillsForAgent } from "../src/skills.js";
import {
  encodeToken,
  resolveTurns,
  setSessionCookie,
  checkAndCountIp,
  IP_WINDOW_DAYS,
} from "./_limits.js";
import { MAX_FILES } from "./upload.js";

const MODEL = "claude-haiku-4-5";
const MAX_OUTPUT_TOKENS = 1200;
const MAX_HISTORY_MESSAGES = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Skills like /initialize are meant to actually run — see the "init" request
// flag below, which fires a real /initialize as the first turn so the template's
// context primes the model. This addendum exists because the model would
// otherwise sometimes echo the bare token "/initialize" instead of producing
// that skill's defined output.
const CHAT_MODE_ADDENDUM = `

---
Skills such as /initialize and /help can be triggered either by the user typing that exact command, or by the app itself invoking it internally — for example, the very first turn of a brand-new conversation is always an internal /initialize call. Either way, when a skill is triggered, produce that skill's actual defined output directly. Never respond with just the bare command name/token (e.g. the literal text "/initialize") — that name is an internal trigger label, not something to say to the user.`;

// The templates mark some skills "(DISABLED IN FREE DEMO)". The UX and Data
// templates already carry a note about that; personas don't, and in all cases
// it's worth being explicit about the intended behaviour: describe, don't run.
function demoModeAddendum(agent) {
  const disabled = skillsForAgent(agent.id).filter((s) => s.disabled);
  if (!disabled.length) return "";
  const list = disabled.map((s) => s.command).join(", ");
  return `

---
# FREE DEMO MODE — DISABLED SKILLS

This is a limited free demo. These skills are DISABLED and CANNOT be run here: ${list}.

When a user asks for a disabled skill, check that it is disabled BEFORE anything else. This check comes first — before the general rule about asking for missing inputs. Do all of the following:
- Say plainly and immediately that this skill isn't available in the free demo.
- Explain in a sentence or two what it produces and when you'd reach for it in a real engagement.
- Suggest a skill that IS available as a useful next step.

When a user asks for a disabled skill, you must NOT:
- Produce its output, or any partial version of its output.
- Ask them to supply its inputs, paste data, or upload files for it.
- Say you'd be "happy to" run it, or imply you will once they provide something. Never promise a deliverable you cannot produce.
- Generate the document, table, index, or file it would normally create, or offer a download.

Every skill NOT in that list works normally. This conversation is also limited to a fixed number of turns, and files created by skills cannot be downloaded in the demo.`;
}

// Only applied to the internal /initialize call. The persona template chains
// /initialize straight into /help's full skill listing, which reads as an
// unprompted info-dump — the UI has its own skills panel, so stop after the
// greeting and let the user actually ask.
const INIT_ADDENDUM = `

---
For this specific /initialize call: stop after your greeting and short "About me" / introduction. Do NOT automatically continue into /help or list your skills menu — the interface already shows the skill list separately. End with one short line noting that /help is available if they want it, then stop and wait for the user's next message.`;

// Turns a stored attachment reference into the right content block. The block
// type has to match the file's media type — a PDF must be a `document`, a PNG
// must be an `image`, or the API rejects it.
function attachmentBlock(att) {
  if (att.kind === "image") {
    return { type: "image", source: { type: "file", file_id: att.fileId } };
  }
  return {
    type: "document",
    source: { type: "file", file_id: att.fileId },
    title: att.filename?.slice(0, 200) || undefined,
  };
}

function buildApiMessages(messages) {
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        (typeof m.content === "string" || Array.isArray(m.attachments)),
    )
    .map((m) => {
      const text = typeof m.content === "string" ? m.content.slice(0, 12000) : "";
      const atts = Array.isArray(m.attachments) ? m.attachments.slice(0, MAX_FILES) : [];

      if (m.role === "assistant" || !atts.length) {
        return { role: m.role, content: text };
      }

      // Attachments first, then the text — the API wants document/image blocks
      // to precede the prompt that refers to them.
      return {
        role: "user",
        content: [
          ...atts.filter((a) => a?.fileId).map(attachmentBlock),
          { type: "text", text: text || "(see attached)" },
        ],
      };
    });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { agentId, messages, token, init } = req.body ?? {};

    const agent = getAgent(agentId);
    if (!agent) {
      res.status(400).json({ error: "Unknown agent" });
      return;
    }
    const maxTurns = agent.maxTurns;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages must be a non-empty array" });
      return;
    }
    if (messages.length > MAX_HISTORY_MESSAGES) {
      res.status(400).json({ error: "Conversation too long for this endpoint" });
      return;
    }

    // Turn count comes from whichever source is further along — the httpOnly
    // cookie or the request body — so reloading the page can't rewind it.
    const { turns } = resolveTurns(req, token);

    if (!init && turns >= maxTurns) {
      res.status(200).json({
        limitReached: true,
        reply: `We've reached the ${maxTurns}-message limit for this conversation. Start a new one to keep going.`,
        turnsUsed: turns,
        turnsMax: maxTurns,
      });
      return;
    }

    // Per-IP cap (only enforced when Upstash is configured; fails open).
    const ipCheck = await checkAndCountIp(req);
    if (!ipCheck.allowed) {
      res.status(429).json({
        error: `You've used up this demo's allowance from your connection. It resets ${IP_WINDOW_DAYS} days after your first message.`,
      });
      return;
    }

    const system =
      agent.description +
      CHAT_MODE_ADDENDUM +
      demoModeAddendum(agent) +
      (init ? INIT_ADDENDUM : "");

    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: buildApiMessages(messages),
      // Required for referencing uploaded files by file_id. Note this belongs
      // in the params object — the second argument is RequestOptions and
      // silently ignores `betas`, which makes file_id sources fail validation.
      betas: ["files-api-2025-04-14"],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock ? textBlock.text : "";

    // The /initialize priming turn is app-triggered context-setting, not a real
    // exchange, so it doesn't consume the user's budget.
    const newTurns = init ? turns : turns + 1;
    const newToken = encodeToken(newTurns, agent.id);
    setSessionCookie(res, newToken);

    res.status(200).json({
      reply,
      token: newToken,
      turnsUsed: newTurns,
      turnsMax: maxTurns,
      limitReached: newTurns >= maxTurns,
    });
  } catch (err) {
    console.error("chat handler error:", err);
    if (err?.status === 429) {
      res.status(429).json({ error: "Rate limited, please wait and try again." });
      return;
    }
    res.status(500).json({ error: "Something went wrong talking to the model." });
  }
}
