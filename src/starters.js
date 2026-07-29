// starters.js
// Opening suggestions shown once per conversation, before the first real
// message. They exist to answer "what do I even ask this thing?" — so each one
// is a genuinely useful first move, not a demo script.
//
// `fill: true` means the starter needs something from the user (a transcript to
// clean, a challenge to critique), so clicking it puts the text in the composer
// with focus rather than sending straight away. Everything else sends on click.

// Questions that work for any persona. Two are rotated in per conversation so
// the demo doesn't feel scripted, and so someone who tries several personas —
// or restarts one — sees different ways in rather than the same five cards.
//
// Normalised to second person throughout (the user is addressing the persona);
// two of the supplied drafts were third-person or had a typo.
const SHARED_QUESTION_POOL = [
  {
    label: "How do you decide where to eat?",
    prompt: "How do you make decisions about where to eat?",
    hint: "The actual decision process",
  },
  {
    label: "Where do you hear about new places?",
    prompt: "Where do you hear about new restaurants or food trucks?",
    hint: "Which channels actually reach you",
  },
  {
    label: "How should BorderBlend talk to you?",
    prompt: "How should BorderBlend talk to you?",
    hint: "Tone, channel, and frequency that would land",
  },
  {
    label: "What would make you sign up for something?",
    prompt: "Under what conditions would you sign up for something?",
    hint: "What it takes to get an opt-in",
  },
  {
    label: "What would make you walk away?",
    prompt: "What would make you walk away from BorderBlend?",
    hint: "The dealbreakers",
  },
  {
    label: "Who are you actually ordering for?",
    prompt: "Who are you actually ordering for?",
    hint: "Rarely just themselves",
  },
  {
    label: "Is the fusion the point, or is it just tacos?",
    prompt: "The fusion — is that the point for you, or is it just tacos?",
    hint: "The strategic question behind the brand",
  },
  {
    label: "How have your experiences been so far?",
    prompt: "How have your experiences with BorderBlend been so far?",
    hint: "Their history with the brand",
  },
];

// Deterministic pick so cards don't reshuffle on every keystroke — the seed is
// fixed per conversation and only changes when a new conversation starts.
function pickFromPool(pool, count, seed) {
  const remaining = [...pool];
  const chosen = [];
  let s = Math.floor(seed * 233280) || 1;
  for (let i = 0; i < count && remaining.length; i++) {
    s = (s * 9301 + 49297) % 233280;
    chosen.push(remaining.splice(Math.floor((s / 233280) * remaining.length), 1)[0]);
  }
  return chosen;
}

// The stage to map varies by persona — "when you first came across BorderBlend"
// is ambiguous for Diego, who encountered it as a prospective franchisee rather
// than a customer.
//
// Uses the slash form, which is worth modelling for users since it's the syntax
// they'd type in their own tools. /j-questions is the exception: the template
// scopes it to "this stage", so as an opening message — with no stage discussed
// yet — a plain question gets a better answer than a bare command.
function personaCommon(stageDescription) {
  return [
    {
      label: "Map a journey stage",
      prompt: `/j-stage ${stageDescription}`,
      // Hints are written from the persona's side, since it's the persona
      // speaking on these cards — "my" voice, not "your" voice.
      hint: "In my own voice: goals, problems, sentiment, and a quote",
    },
    {
      label: "Push back on an idea",
      prompt: "/ideate ",
      hint: "Describe a change and I'll be frank about it",
      fill: true,
    },
  ];
}

const CONSUMER_STAGE =
  "the stage where you first came across BorderBlend and were deciding whether to try it";

// Diego met BorderBlend as a prospective operator, not a hungry customer. He's
// also a composite archetype with no mapped journey, so this needs to be
// specific about which decision and what he was doing in it — a looser framing
// gets a clarifying question instead of a mapped stage.
const FRANCHISEE_STAGE =
  "the decision stage where you were evaluating whether to sign on as a BorderBlend operator — running the numbers and talking to existing operators";

export const STARTERS_BY_AGENT = {
  omar: [
    {
      label: "Walk me through a typical weekday lunch",
      prompt: "Walk me through a typical weekday lunch — start to finish.",
      hint: "How the routine actually works",
    },
    ...personaCommon(CONSUMER_STAGE),
  ],
  grace: [
    {
      label: "How do you organise a team lunch?",
      prompt: "How do you organise lunch for the team — what does that involve?",
      hint: "The coordination nobody sees",
    },
    {
      label: "What goes wrong with catering orders?",
      prompt: "What tends to go wrong when you order catering for a group?",
      hint: "Where the risk sits for you",
    },
    ...personaCommon(CONSUMER_STAGE),
  ],
  mateo: [
    {
      label: "What's ordering at 1am actually like?",
      prompt: "What's it actually like trying to get food after a late shift?",
      hint: "The late-night reality",
    },
    {
      label: "Why do you bring people along?",
      prompt: "You often turn up with a group — why, and how does that work?",
      hint: "How you became the convener",
    },
    ...personaCommon(CONSUMER_STAGE),
  ],
  diego: [
    {
      label: "What's hardest about running the trucks?",
      prompt: "What's the hardest part of running your trucks day to day?",
      hint: "Operator reality, unvarnished",
    },
    {
      label: "Where does head office help or hinder?",
      prompt: "Where does the head office relationship help you, and where does it get in the way?",
      hint: "The franchise tension",
    },
    ...personaCommon(FRANCHISEE_STAGE),
  ],
  tyler: [
    {
      label: "What would make you a regular?",
      prompt: "What would it take for you to become a regular somewhere?",
      hint: "Convenience vs loyalty",
    },
    ...personaCommon(CONSUMER_STAGE),
  ],

  // Note: these prompts are deliberately fully specified. The master templates
  // instruct the assistants to stop and ask when a skill is missing input, which
  // is correct behaviour — so a vague starter gets a clarifying question instead
  // of a result, which is a poor first impression. Say which persona, which
  // scope, and that working from the case summary is fine.
  ux: [
    {
      label: "Outline a journey",
      prompt:
        "/j-outline Omar's journey from first hearing about BorderBlend to becoming a twice-weekly regular. Work from the persona summary you already have.",
      hint: "Stages, goals, tasks, and decision gates",
    },
    {
      label: "Turn a persona into user stories",
      prompt:
        "/stories for Omar across his whole journey. Work from the persona summary you already have and flag any inferences as assumptions.",
      hint: "With acceptance criteria and priority signals",
    },
    {
      label: "Simulate two personas together",
      prompt:
        "/j-multi-dialogue Omar and Grace deciding where to order lunch for a client meeting. Work from the persona summaries you already have.",
      hint: "Dialogue, including where they conflict",
    },
    {
      label: "Work through a design challenge",
      prompt: "/ideate ",
      hint: "Describe the challenge — I'll be direct about trade-offs",
      fill: true,
    },
  ],

  data: [
    {
      label: "Clean up a transcript",
      prompt: "/transcript-cleanup ",
      hint: "Paste or attach it — I'll structure it and keep the verbatims",
      fill: true,
    },
    {
      label: "Suggest personas for a scenario",
      prompt:
        "/personas Canadian food trucks, weekday lunch ordering. Go ahead and suggest 4-5 personas now using your best assumptions — flag them as assumptions rather than asking me first.",
      hint: "Roles, goals, tasks, and pain points",
    },
    {
      label: "Build personas from my research",
      prompt: "I have research I'd like to build personas from — where do we start?",
      hint: "Synthesise rather than invent",
    },
    {
      label: "Show me what you can do",
      prompt: "/help",
      hint: "The full skill list, with what's live in the demo",
    },
  ],
};

// Which agents get questions rotated in from the shared pool. The assistants
// don't — those questions are addressed to a research subject, not to a tool.
const ROTATES = new Set(["omar", "grace", "mateo", "diego", "tyler"]);
const ROTATE_COUNT = 2;

/**
 * @param agentId  which agent's starters to build
 * @param seed     0-1, fixed per conversation. Same seed gives the same cards,
 *                 so they don't reshuffle mid-conversation; a new conversation
 *                 gets a new seed and therefore different questions.
 */
export function startersForAgent(agentId, seed = 0.5) {
  const base = STARTERS_BY_AGENT[agentId] ?? [];
  if (!ROTATES.has(agentId)) return base;

  // Rotated questions sit after the persona-specific openers but before the
  // skill cards, so the ordering stays: about you → about you → run a skill.
  const rotated = pickFromPool(SHARED_QUESTION_POOL, ROTATE_COUNT, seed);
  const skillCards = base.filter((s) => s.prompt.trim().startsWith("/"));
  const questionCards = base.filter((s) => !s.prompt.trim().startsWith("/"));
  return [...questionCards, ...rotated, ...skillCards];
}
