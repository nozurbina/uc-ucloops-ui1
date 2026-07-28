// assistants.js
// The non-persona ucLoops agents: the UX Assistant and the Data Assistant.
// Unlike personas (who roleplay a research subject in first person), these are
// working assistants that run methodology skills with the user.
//
// Templates are compiled from src/ucLoops-templates/*.md by
// scripts/build-templates.mjs, so the markdown stays the source of truth.

import {
  UX_ASSISTANT_TEMPLATE,
  DATA_ASSISTANT_TEMPLATE,
  SHARED_SKILLS,
  TRANSCRIPT_CLEANUP_SKILL,
} from "./templates.generated.js";

const JOIN = `

`;

export const ASSISTANTS = [
  {
    id: "ux",
    name: "UX Assistant",
    label: "ucLoops UX Assistant",
    emoji: "🧭",
    type: "assistant",
    builtin: true,
    description: UX_ASSISTANT_TEMPLATE + JOIN + SHARED_SKILLS,
  },
  {
    id: "data",
    name: "Data Assistant",
    label: "ucLoops Data Analyst Assistant",
    emoji: "📊",
    type: "assistant",
    builtin: true,
    // The Data Assistant's /transcript-cleanup skill lives in its own file
    // (the template just points at "relevant separate skill file"), so it has
    // to be appended or that skill has no instructions to follow.
    description:
      DATA_ASSISTANT_TEMPLATE +
      JOIN +
      SHARED_SKILLS +
      JOIN +
      `# /transcript-cleanup SKILL (referenced by the SKILLS list above)

` +
      TRANSCRIPT_CLEANUP_SKILL,
  },
];
