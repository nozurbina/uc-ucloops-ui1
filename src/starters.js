// starters.js
// Opening suggestions shown once per conversation, before the first real
// message. They exist to answer "what do I even ask this thing?" — so each one
// is a genuinely useful first move, not a demo script.
//
// Three kinds of starter:
//   default        — clicking sends the prompt as a message
//   fill: true     — needs something from the user (a transcript, a challenge),
//                    so it lands in the composer with focus instead of sending
//   action: "…"    — not a message at all; opens something in the interface.
//                    Costs no turns and no tokens.

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
    {
      // Opens the Sources & evidence panel rather than asking the persona,
      // which is both instant and more honest: the panel lists the actual
      // interviews with links, where the persona would only describe them.
      label: "Show me the evidence you're based on",
      hint: "Opens the interviews and research behind me",
      action: "sources",
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

// Persona-specific question pools. There are more here than fit on screen, so
// two are rotated in per conversation — same mechanism as the shared pool. This
// is where to add new persona questions; nothing else needs changing.
const PERSONA_POOLS = {
  omar: [
    {
      label: "Walk me through a typical weekday lunch",
      prompt: "Walk me through a typical weekday lunch — start to finish.",
      hint: "How the routine actually works",
    },
    {
      label: "What job does lunch need to do?",
      prompt: "What's the actual job you need lunch to do?",
      hint: "The brief, in his own terms",
    },
    {
      label: "What's ordering for the team like?",
      prompt: "You're often ordering for the team, not just yourself — what's that like?",
      hint: "The part that isn't about him",
    },
    {
      label: "What happens to the receipt?",
      prompt: "What happens to your receipt by the time finance wants it?",
      hint: "Expensing friction",
    },
    {
      label: "What would make it a weekly fixture?",
      prompt: "What would it take for BorderBlend to become a fixture in your week?",
      hint: "From option to infrastructure",
    },
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
    {
      label: "How did you first find BorderBlend?",
      prompt: "How did you actually first find BorderBlend?",
      hint: "The discovery route",
    },
    {
      label: "The week before a big client booking",
      prompt: "Walk me through the week before a big client booking.",
      hint: "The prep nobody sees",
    },
    {
      label: "How do you handle allergies for thirty?",
      prompt: "How do you handle allergies for a group of thirty?",
      hint: "The detail that carries the risk",
    },
    {
      label: "What's the Calgary winter problem?",
      prompt:
        "What's the Calgary winter problem, and what would make you route everything to BorderBlend?",
      hint: "Seasonality, and what would win the whole account",
    },
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
      hint: "How he became the convener",
    },
    {
      label: "Walk me through a typical night",
      prompt: "Walk me through a typical night — when does your shift end, and what happens next?",
      hint: "Shift end to first bite",
    },
    {
      label: "What made you a regular?",
      prompt: "What made you a BorderBlend regular in the first place?",
      hint: "The moment it converted him",
    },
    {
      label: "What makes the brisket different?",
      prompt:
        'What makes the brisket different from other places\' "smoked brisket"?',
      hint: "Why he can tell, and why it matters",
    },
    {
      label: "Most frustrating thing about being a fan?",
      prompt: "What's the single most frustrating thing about being a fan of this truck?",
      hint: "The cost of loyalty",
    },
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
    {
      label: "How did you end up owning trucks?",
      prompt: "How did you end up owning BorderBlend trucks?",
      hint: "The route into the franchise",
    },
    {
      label: "How do you know the trucks are doing well?",
      prompt: "How do you know if your trucks are actually doing well?",
      hint: "What he can measure, and what he can't",
    },
    {
      label: "What should HQ do with your data?",
      prompt:
        "You've got years of local customer data. What do you wish HQ would do with it?",
      hint: "Local insight vs national decisions",
    },
    {
      label: "How would you grow without losing the standard?",
      prompt:
        "What would it take to grow from a couple of trucks to a small fleet without dropping the brisket standard?",
      hint: "Scaling without diluting",
    },
  ],

  tyler: [
    {
      label: "What would make you a regular?",
      prompt: "What would it take for you to become a regular somewhere?",
      hint: "Convenience vs loyalty",
    },
    {
      label: "Why BorderBlend?",
      prompt: "Why BorderBlend?",
      hint: "Blunt, and probably short",
    },
    {
      label: "Do you follow the brand online?",
      prompt: "Do you follow the brand anywhere online?",
      hint: "Which channels reach him, and which don't",
    },
    {
      label: "What if the truck isn't there?",
      prompt: "What happens if the truck isn't there when you get off the train?",
      hint: "The fallback behaviour",
    },
    {
      label: "What do you make of the price?",
      prompt: "What do you make of the price — has it changed how you feel about going?",
      hint: "Price sensitivity",
    },
  ],
};

export const STARTERS_BY_AGENT = {
  omar: [...personaCommon(CONSUMER_STAGE)],
  grace: [...personaCommon(CONSUMER_STAGE)],
  mateo: [...personaCommon(CONSUMER_STAGE)],
  diego: [...personaCommon(FRANCHISEE_STAGE)],
  tyler: [...personaCommon(CONSUMER_STAGE)],

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
      label: "Turn a journey into user stories",
      prompt:
        "/stories for Omar across his whole journey. Organise them by journey stage and flag any assumptions that you make that go beyond the source data.",
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
      hint: "Describe the challengeor idea. I'll be direct about trade-offs",
      fill: true,
    },
  ],

  data: [
    {
      label: "Clean up a transcript",
      prompt: "/transcript-cleanup ",
      hint: "Paste or attach it. I'll ask you to confirm key nouns and then structure it, keeping the verbatims",
      fill: true,
    },
    {
      label: "Suggest personas for a scenario",
      prompt:
        "/personas Pharmaceutical drug trial participants with diverse backgrounds, emotional context, and digital literacy. Suggest 4-5 personas now using your best assumptions — flag them as assumptions rather than asking me first.",
      hint: "Roles, goals, tasks, and pain points",
    },
    {
      label: "Build personas from my research",
      prompt: "I have research I'd like to build personas from — where do we start?",
      hint: "Consolidate rather than invent",
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

  // Two pools, drawn independently: questions specific to this persona, and
  // questions that suit any of them. The shared pool uses a derived seed so it
  // doesn't move in lockstep with the persona pool.
  const personaPicks = pickFromPool(PERSONA_POOLS[agentId] ?? [], ROTATE_COUNT, seed);
  const sharedPicks = pickFromPool(SHARED_QUESTION_POOL, ROTATE_COUNT, (seed * 7.13) % 1);

  // Ordering: persona-specific → general → skills → interface actions. Action
  // cards go last because they leave the conversation rather than advancing it.
  // `prompt` is optional on action cards, hence the ?? "".
  const isSkill = (s) => (s.prompt ?? "").trim().startsWith("/");
  const actionCards = base.filter((s) => s.action);
  const skillCards = base.filter((s) => !s.action && isSkill(s));

  return [...personaPicks, ...sharedPicks, ...skillCards, ...actionCards];
}
