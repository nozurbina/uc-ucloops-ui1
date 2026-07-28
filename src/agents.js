// agents.js
// Single registry of every agent the chat API can serve: the 5 BorderBlend
// personas plus the UX and Data assistants.
//
// Turn limits live here (server-authoritative — api/chat.js reads them from
// this registry rather than trusting anything the client sends). Assistants get
// a larger budget than personas because their skills are multi-step workflows
// (gather context -> run skill -> refine) rather than single Q&A exchanges.

import { PERSONAS } from "./personas.js";
import { ASSISTANTS } from "./assistants.js";

const PERSONA_MAX_TURNS = 15;
const ASSISTANT_MAX_TURNS = 25;

export const AGENTS = [
  ...PERSONAS.map((p) => ({ ...p, maxTurns: PERSONA_MAX_TURNS })),
  ...ASSISTANTS.map((a) => ({ ...a, maxTurns: ASSISTANT_MAX_TURNS })),
];

export function getAgent(id) {
  return AGENTS.find((a) => a.id === id);
}
