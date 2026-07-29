// skills.js
// Client-safe catalogue of the skills each agent exposes, used by the
// "Available skills" panel and the quick-insert popup in the message box.
//
// This is UI metadata only — the authoritative skill *instructions* live in the
// markdown templates (compiled into templates.generated.js and sent as the
// system prompt). Keep `command` values here in sync with those templates.
//
// `disabled: true` marks a skill that is present in the methodology but not
// runnable in the free demo. Those are deliberately still listed and described:
// the agent should explain what the skill does and when you'd reach for it in a
// real engagement, but not produce its output. See DEMO_MODE_ADDENDUM in
// api/chat.js for the server-side enforcement.

const SHARED_SKILLS_CATALOGUE = [
  {
    command: "/help",
    group: "Getting started",
    description: "List all available skills with descriptions",
    example: "/help",
  },
  {
    command: "/learn",
    group: "Getting started",
    description: "Add context or background information to the current conversation",
    example: "/learn Your favourite colour is violet",
  },
  {
    command: "/sticky",
    group: "Formatting & output",
    description: "Rewrite output as short sticky-note fragments suitable for whiteboarding",
    example: "/sticky",
  },
  {
    command: "/summary",
    group: "Formatting & output",
    description: "Create a structured summary of everything discussed in this conversation",
    example: "/summary",
  },
  {
    command: "/p-create-page",
    group: "Formatting & output",
    description: "Turn a persona export into a standalone, styled HTML persona profile",
    example: "/p-create-page",
    disabled: true,
  },
  {
    command: "/j-create-page",
    group: "Formatting & output",
    description: "Render journey stage outputs into a standalone, styled HTML journey map",
    example: "/j-create-page",
    disabled: true,
  },
];

const PERSONA_SKILLS = [
  {
    command: "/initialize",
    group: "Getting started",
    description: "Have me introduce myself and explain what I can help with",
    example: "/initialize",
  },
  {
    command: "/j-stage",
    group: "Journey mapping",
    description:
      "Map one stage of journey stage based on the context you suggest. Includes goals, narrative, questions, channels, and more",
    example: "/j-stage You've just been presented with this [new situation]",
  },
  {
    command: "/j-questions",
    group: "Journey mapping",
    description: "Generate fresh, stage-specific questions about my experience and motivations",
    example: "/j-questions",
  },
  {
    command: "/ideate",
    group: "Ideation",
    description:
      "Work through a challenge with me — I'll be frank about pros, cons, and risks",
    example: "/ideate What would make you sign up to receive emails from our brand?",
  },
  ...SHARED_SKILLS_CATALOGUE,
];

const UX_SKILLS = [
  {
    command: "/wizard",
    group: "Getting started",
    description: "Switch to verbose Research Wizard mode with guided steps",
    example: "/wizard",
  },
  {
    command: "/j-outline",
    group: "Journey mapping",
    description: "Create a journey outline with stages, goals, tasks, and decision gates. Can be persona specific or general",
    example: "/j-outline Omar's (or 'A customer') journey from first hearing about the brand to becoming a regular",
  },
  {
    command: "/j-multi-outline",
    group: "Journey mapping",
    description:
      "Create a multi-persona journey outline, accounting for personas with conflicting motivations",
    example: "/j-multi-outline Omar and Grace organising a team lunch together",
  },
  {
    command: "/j-multi-dialogue",
    group: "Journey mapping",
    description: "Simulate realistic dialogue and interaction between several personas",
    example: "/j-multi-dialogue Omar and Grace deciding where to order lunch from",
  },
  {
    command: "/j-suggest",
    group: "Journey mapping",
    description:
      "Suggest opportunities, content assets, CTAs, and entry/transition signals for a journey stage",
    example: "/j-suggest Based on the trusted-tip stage",
    disabled: true,
  },
  {
    command: "/j-data",
    group: "Journey mapping",
    description: "Suggest data generated and data used for personalisation at a given stage",
    example: "/j-data Based on the solo-vetting stage",
    disabled: true,
  },
  {
    command: "/stories",
    group: "Requirements",
    description: "Generate user stories with acceptance criteria, sources, and priority signals",
    example: "/stories From Omar's goals and pain points",
  },
  {
    command: "/ideate",
    group: "Ideation",
    description: "Brainstorm a context or challenge with pros, cons, and risks",
    example: "/ideate How can we reduce wait-time anxiety at the truck?",
  },
  ...SHARED_SKILLS_CATALOGUE,
];

const DATA_SKILLS = [
  {
    command: "/initialise",
    group: "Getting started",
    description: "Switch to Data Wizard mode and see common starting tasks",
    example: "/initialise",
  },
  {
    command: "/personas",
    group: "Persona building",
    description:
      "Suggest several personas from an industry/brand plus a journey scenario, or from supplied research",
    example: "/personas Food trucks, weekday lunch ordering",
  },
  {
    command: "/persona-export",
    group: "Persona building",
    description:
      "Synthesise a full persona into a single structured markdown document ready for copy-paste",
    example: "/persona-export Omar",
    disabled: true,
  },
  {
    command: "/transcript-cleanup",
    group: "Research processing",
    description:
      "Clean and structure a raw interview or meeting transcript, preserving verbatim quotes and each speaker's voice",
    example: "/transcript-cleanup (then paste or attach your transcript)",
  },
  {
    command: "/create-index",
    group: "Research processing",
    description:
      "Extract a dataset into an indexed table with stable item IDs, source references, and flagged assumptions",
    example: "/create-index",
    disabled: true,
  },
  {
    command: "/clean-index",
    group: "Research processing",
    description: "Review an index for duplication and overlap, and propose resolutions",
    example: "/clean-index",
    disabled: true,
  },
  ...SHARED_SKILLS_CATALOGUE,
];

export const SKILLS_BY_AGENT = {
  omar: PERSONA_SKILLS,
  grace: PERSONA_SKILLS,
  mateo: PERSONA_SKILLS,
  diego: PERSONA_SKILLS,
  tyler: PERSONA_SKILLS,
  ux: UX_SKILLS,
  data: DATA_SKILLS,
};

// The journey-mapping workflow chain, shown as a hint in the skills panel so
// people can see how the skills compose rather than treating them as isolated.
export const WORKFLOW_CHAIN = {
  title: "Journey mapping workflow",
  steps: [
    { command: "/j-outline", agent: "UX Assistant" },
    { command: "/j-stage", agent: "Persona" },
    { command: "/j-suggest", agent: "UX Assistant", disabled: true },
    { command: "/j-data", agent: "UX Assistant", disabled: true },
  ],
  note: "/j-outline defines the stages → /j-stage fills each one in the persona's voice → /j-suggest and /j-data build on those results",
};

// Every command marked disabled anywhere, so the workflow diagram can label
// availability from the same source the agents and the skills panel use —
// nothing to keep manually in sync.
export const DISABLED_COMMANDS = new Set(
  Object.values(SKILLS_BY_AGENT)
    .flat()
    .filter((s) => s.disabled)
    .map((s) => s.command),
);

export function isDisabled(command) {
  return DISABLED_COMMANDS.has(command);
}

export function skillsForAgent(agentId) {
  return SKILLS_BY_AGENT[agentId] ?? [];
}

export function groupedSkillsForAgent(agentId) {
  const skills = skillsForAgent(agentId);
  const order = [];
  const groups = new Map();
  for (const s of skills) {
    if (!groups.has(s.group)) {
      groups.set(s.group, []);
      order.push(s.group);
    }
    groups.get(s.group).push(s);
  }
  return order.map((name) => ({ name, skills: groups.get(name) }));
}
