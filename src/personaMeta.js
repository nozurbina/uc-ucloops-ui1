// Lightweight, client-safe persona metadata for the picker UI + the
// "Sources" transparency panel. The full system-prompt data (with complete
// interview transcripts and journey-map content) lives in personas.js,
// which is imported ONLY by the server-side /api/chat function — never
// bundled into the client.

const SITE = "https://urbinaconsulting.com/shares/ucloops/borderblend";

export const PERSONA_META = [
  {
    id: "omar",
    name: "Omar",
    role: "Business Lunch — financial-district professional",
    detail: "Solo weekday lunch · Toronto · 34",
    avatar: "/headshots/omar.jpg",
    initial: "O",
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
    name: "Grace",
    role: "Business Lunch — office manager & catering coordinator",
    detail: "Team lunch & catering · Calgary · 41",
    avatar: "/headshots/grace.jpg",
    initial: "G",
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
    name: "Mateo",
    role: "Late-Night Foodie — nightlife service worker",
    detail: "Toronto · 26",
    avatar: "/headshots/mateo.jpg",
    initial: "M",
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
    name: "Diego",
    role: "Franchisee / Operator — multi-truck veteran",
    detail: "Toronto · 4 years running trucks",
    avatar: "/headshots/diego.jpg",
    initial: "D",
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
    name: "Tyler",
    role: "Everyday 20-something — convenience-first eater",
    detail: "Vancouver · 24",
    avatar: "/headshots/tyler.jpg",
    initial: "T",
    profileUrl: `${SITE}/persona-everyday-20s-v3.html`,
    journeyUrl: null,
    journeyLabel: null,
    sources: [
      { id: "BB-INT015", label: "BB-INT015 — Tyler Brooks", words: 1444, url: `${SITE}/sources/BB-INT015.html` },
      { id: "BB-INT016", label: "BB-INT016 — Megan Liu", words: 1925, url: `${SITE}/sources/BB-INT016.html` },
    ],
  },
];

export function sourceWordTotal(persona) {
  return persona.sources.reduce((sum, s) => sum + s.words, 0);
}
