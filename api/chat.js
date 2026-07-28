import Anthropic from "@anthropic-ai/sdk";
import crypto from "node:crypto";
import { PERSONAS } from "../src/personas.js";

const MODEL = "claude-haiku-4-5";
const MAX_TURNS = 15;
const MAX_OUTPUT_TOKENS = 700;
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_HISTORY_MESSAGES = 40; // hard cap on what a client can send us

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The persona master template defines slash-commands like /initialize and
// /help for tools that have a command router. This app doesn't — it's
// direct Q&A only — so make that explicit, otherwise the model sometimes
// echoes a literal command name instead of just answering in character.
const CHAT_MODE_ADDENDUM = `

---
You are already mid-conversation with a researcher in a live chat interface. There is no command router here — do NOT run /initialize, /help, or any other named skill unless the user's message literally contains that exact command. For every normal message, just answer naturally and fully in character based on everything above. Never output a bare command name (like "/initialize") as your response.`;

function sign(payload) {
  const secret = process.env.CHAT_SESSION_SECRET;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// Token = base64url(turns.expiry) + "." + hmac(that string)
// Stateless: server never stores anything, so it works across serverless
// cold starts / different instances. Tampering just fails verification and
// falls back to a fresh (turns=0) session — no worse than the user opening
// a new tab, which they could always do anyway.
function encodeToken(turns) {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${turns}.${expiry}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decodeToken(token) {
  try {
    const [encoded, sig] = String(token).split(".");
    if (!encoded || !sig) return { turns: 0 };
    const expected = sign(encoded);
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { turns: 0 };
    }
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const [turnsStr, expiryStr] = payload.split(".");
    const turns = parseInt(turnsStr, 10);
    const expiry = parseInt(expiryStr, 10);
    if (!Number.isFinite(turns) || !Number.isFinite(expiry)) return { turns: 0 };
    if (Date.now() > expiry) return { turns: 0 };
    return { turns };
  } catch {
    return { turns: 0 };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { personaId, messages, token } = req.body ?? {};

    const persona = PERSONAS.find((p) => p.id === personaId);
    if (!persona) {
      res.status(400).json({ error: "Unknown persona" });
      return;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages must be a non-empty array" });
      return;
    }
    if (messages.length > MAX_HISTORY_MESSAGES) {
      res.status(400).json({ error: "Conversation too long for this endpoint" });
      return;
    }
    const cleanMessages = messages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

    const { turns } = decodeToken(token);

    if (turns >= MAX_TURNS) {
      res.status(200).json({
        limitReached: true,
        reply:
          "We've reached the message limit for this conversation. Start a new chat to keep going.",
        turnsUsed: turns,
        turnsMax: MAX_TURNS,
      });
      return;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: persona.description + CHAT_MODE_ADDENDUM,
      messages: cleanMessages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock ? textBlock.text : "";

    const newTurns = turns + 1;
    res.status(200).json({
      reply,
      token: encodeToken(newTurns),
      turnsUsed: newTurns,
      turnsMax: MAX_TURNS,
      limitReached: newTurns >= MAX_TURNS,
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
