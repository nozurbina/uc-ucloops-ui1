import Anthropic from "@anthropic-ai/sdk";
import { getAgent } from "../src/agents.js";
import { skillsForAgent } from "../src/skills.js";
import { getAgentMeta, EVIDENCE_MAP_URL } from "../src/agentMeta.js";
import {
  encodeToken,
  resolveTurns,
  setSessionCookie,
  checkAndCountIp,
  checkAndCountDaily,
  requireUnlocked,
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

// A skill invoked bare ("/j-stage") correctly triggers a request for input — but
// the agents were answering with references to things the user has never seen,
// e.g. offering 'Stage 1: "The Word in the Scene"' to someone who doesn't know a
// journey map exists, let alone where to find it. This gives each agent the real
// URLs and stage names, and rules for asking well.
function contextResourcesAddendum(agent) {
  const meta = getAgentMeta(agent.id);
  if (!meta) return "";

  const lines = [`- The BorderBlend evidence map (all of the research): ${EVIDENCE_MAP_URL}`];

  if (meta.profileUrl) {
    lines.push(
      agent.type === "persona"
        ? `- Your own full persona profile: ${meta.profileUrl}`
        : `- Persona profiles: ${meta.profileUrl}`,
    );
  }
  if (meta.journeyUrl && meta.journeyStages?.length) {
    lines.push(
      `- Your mapped journey, the "${meta.journeyLabel}": ${meta.journeyUrl}`,
      `  Its stages, in order: ${meta.journeyStages.map((s) => `"${s}"`).join(" → ")}`,
    );
  }
  if (agent.type === "persona" && !meta.journeyUrl) {
    lines.push(
      `- You have NO mapped journey yet. Don't imply one exists or offer stage names as if they were already agreed — if a journey stage is needed, help the user define one from scratch.`,
    );
  }

  return `

---
# WHAT YOU CAN POINT PEOPLE TO

${lines.join("\n")}

# ASKING FOR INPUT WELL

When a skill needs something you don't have, ask — but assume the user is seeing this for the first time and has read none of the research:

- Never mention a journey, stage, persona, insight, or document as though they already know it exists. Say in the same breath what it is.
- **Hard requirement: the first time in a conversation that you mention your mapped journey or any of its stage names, include the journey map URL from the list above in that same message, as a markdown link.** Same for the persona profile or evidence map if you refer to those. A named artefact with no link is useless to someone who has never seen it. (Once you've linked it in a conversation, you needn't repeat the link.)
- Prefer concrete options over an open question. Where you have real stage names, list them as the choices, and make clear they can also invent a new one.
- If the skill needs a document — a transcript, notes, research — say they can paste it into the message box or attach a file. This interface accepts up to 3 attachments, 1MB each.
- If a skill can't do anything useful yet because the conversation is empty (summarising nothing, restyling output that doesn't exist), say so plainly and suggest what to do first.
- Two or three lines. Don't interrogate.`;
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

  // Password gate — a scanner that finds this endpoint gets a 401, not tokens.
  if (!requireUnlocked(req, res)) return;

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

    // Global daily ceiling, checked before the per-IP counter so a capped day
    // doesn't consume anyone's personal allowance. Returned as HTTP 200 with a
    // flag rather than a 4xx: this state is a deliberate part of the demo's
    // experience (it becomes a "get in touch for full access" prompt), not an
    // error the UI should render in red.
    const daily = await checkAndCountDaily();
    if (!daily.allowed) {
      res.status(200).json({
        demoCapReached: true,
        turnsUsed: turns,
        turnsMax: maxTurns,
      });
      return;
    }

    // Per-IP cap (only enforced when Upstash is configured; fails open).
    const ipCheck = await checkAndCountIp(req);
    if (!ipCheck.allowed) {
      res.status(200).json({
        demoCapReached: true,
        personalCap: true,
        turnsUsed: turns,
        turnsMax: maxTurns,
      });
      return;
    }

    const system =
      agent.description +
      CHAT_MODE_ADDENDUM +
      contextResourcesAddendum(agent) +
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
