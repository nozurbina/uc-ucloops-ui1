// agentMeta.js
// Lightweight, client-safe metadata for the agent picker, header, and sources
// panel. The full system prompts (with complete interview transcripts) live in
// personas.js / assistants.js, imported ONLY by the serverless functions —
// never bundled into the browser.

const SITE = "https://urbinaconsulting.com/shares/ucloops/borderblend";

export const PERSONA_META = [
  {
    id: "omar",
    type: "persona",
    name: "Omar",
    role: "Business Lunch — financial-district professional",
    detail: "Solo weekday lunch · Toronto · 34",
    avatar: "/headshots/omar.jpg",
    initial: "O",
    maxTurns: 15,
    profileUrl: `${SITE}/persona-omar-v3.html`,
    journeyUrl: `${SITE}/journey-map-business-lunch-v3.html`,
    journeyLabel: "Business Lunch journey map",
    sources: [
      { id: "BB-INT013", label: "BB-INT013 — David Okonkwo", words: 2076, url: `${SITE}/sources/BB-INT013.html` },
      { id: "BB-INT019", label: "BB-INT019 — Wesley Cho", words: 2849, url: `${SITE}/sources/BB-INT019.html` },
    ],
  },
  {
    id: "grace",
    type: "persona",
    name: "Grace",
    role: "Business Lunch — office manager & catering coordinator",
    detail: "Team lunch & catering · Calgary · 41",
    avatar: "/headshots/grace.jpg",
    initial: "G",
    maxTurns: 15,
    profileUrl: `${SITE}/persona-grace-v3.html`,
    journeyUrl: `${SITE}/journey-map-business-lunch-v3.html`,
    journeyLabel: "Business Lunch journey map",
    sources: [
      { id: "BB-INT014", label: "BB-INT014 — Nadia Haddad", words: 2417, url: `${SITE}/sources/BB-INT014.html` },
      { id: "BB-INT020", label: "BB-INT020 — Bianca Rossi", words: 2780, url: `${SITE}/sources/BB-INT020.html` },
    ],
  },
  {
    id: "mateo",
    type: "persona",
    name: "Mateo",
    role: "Late-Night Foodie — nightlife service worker",
    detail: "Toronto · 26",
    avatar: "/headshots/mateo.jpg",
    initial: "M",
    maxTurns: 15,
    profileUrl: `${SITE}/persona-late-night-foodie-v3.html`,
    journeyUrl: `${SITE}/journey-map-late-night-v3.html`,
    journeyLabel: "Late-Night Foodie journey map",
    sources: [
      { id: "BB-INT017", label: "BB-INT017 — André Silva", words: 2315, url: `${SITE}/sources/BB-INT017.html` },
      { id: "BB-INT018", label: "BB-INT018 — Sofia Tremblay", words: 1839, url: `${SITE}/sources/BB-INT018.html` },
    ],
  },
  {
    id: "diego",
    type: "persona",
    name: "Diego",
    role: "Franchisee / Operator — multi-truck veteran",
    detail: "Toronto · 4 years running trucks",
    avatar: "/headshots/diego.jpg",
    initial: "D",
    maxTurns: 15,
    profileUrl: `${SITE}/persona-franchisee-v3.html`,
    journeyUrl: null,
    journeyLabel: null,
    sources: [
      { id: "BB-INT001", label: "BB-INT001 — Diego Montoya", words: 1182, url: `${SITE}/sources/BB-INT001.html` },
      { id: "BB-INT002", label: "BB-INT002 — Marc Bélanger", words: 1065, url: `${SITE}/sources/BB-INT002.html` },
      { id: "BB-INT003", label: "BB-INT003 — Beatriz Santos", words: 1182, url: `${SITE}/sources/BB-INT003.html` },
      { id: "BB-INT004", label: "BB-INT004 — Yuki Tanaka", words: 1090, url: `${SITE}/sources/BB-INT004.html` },
      { id: "BB-INT005", label: "BB-INT005 — Kenji Watanabe", words: 1031, url: `${SITE}/sources/BB-INT005.html` },
      { id: "BB-INT006", label: "BB-INT006 — Aisha Thompson", words: 1209, url: `${SITE}/sources/BB-INT006.html` },
      { id: "VER-INT009", label: "VER-INT009 — Patrick Leblanc", words: 2293, url: `${SITE}/sources/VER-INT009.html` },
    ],
  },
  {
    id: "tyler",
    type: "persona",
    name: "Tyler",
    role: "Everyday 20-something — convenience-first eater",
    detail: "Vancouver · 24",
    avatar: "/headshots/tyler.jpg",
    initial: "T",
    maxTurns: 15,
    profileUrl: `${SITE}/persona-everyday-20s-v3.html`,
    journeyUrl: null,
    journeyLabel: null,
    sources: [
      { id: "BB-INT015", label: "BB-INT015 — Tyler Brooks", words: 1444, url: `${SITE}/sources/BB-INT015.html` },
      { id: "BB-INT016", label: "BB-INT016 — Megan Liu", words: 1925, url: `${SITE}/sources/BB-INT016.html` },
    ],
  },
];

export const ASSISTANT_META = [
  {
    id: "ux",
    type: "assistant",
    name: "UX Assistant",
    role: "Journeys, user stories, and ideation",
    detail: "Experience & content design",
    avatar: null,
    initial: "UX",
    accent: "#3131bf",
    maxTurns: 25,
    blurb:
      "A seasoned UX and content designer. Builds journey outlines (including multi-persona ones), turns research into user stories, and works through design challenges with you.",
    sources: [],
  },
  {
    id: "data",
    type: "assistant",
    name: "Data Assistant",
    role: "Research processing and persona synthesis",
    detail: "Data analysis & synthesis",
    avatar: null,
    initial: "DA",
    accent: "#0b6a5b",
    maxTurns: 25,
    blurb:
      "An experienced data analyst. Cleans up raw transcripts, synthesises personas from research, and indexes datasets so findings stay traceable to their source.",
    sources: [],
  },
];

export const AGENT_META = [...PERSONA_META, ...ASSISTANT_META];

export function getAgentMeta(id) {
  return AGENT_META.find((a) => a.id === id);
}

export function sourceWordTotal(agent) {
  return (agent.sources ?? []).reduce((sum, s) => sum + s.words, 0);
}
