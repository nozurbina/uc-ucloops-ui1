// starters.js
// Opening suggestions shown once per conversation, before the first real
// message. They exist to answer "what do I even ask this thing?" — so each one
// is a genuinely useful first move, not a demo script.
//
// `fill: true` means the starter needs something from the user (a transcript to
// clean, a challenge to critique), so clicking it puts the text in the composer
// with focus rather than sending straight away. Everything else sends on click.

// The stage to map varies by persona — "when you first came across BorderBlend"
// is ambiguous for Diego, who encountered it as a prospective franchisee rather
// than a customer.
//
// Phrased as natural language rather than "/j-stage <context>": the templates
// explicitly support inferring a skill from intent, and a slash command with
// prose trailing it on the same line tends to get misread as a malformed
// command rather than a command plus its context.
function personaCommon(stageDescription) {
  return [
    {
      label: "Map a journey stage",
      prompt: `Map out ${stageDescription}, using your j-stage format.`,
      hint: "In your own voice: goals, problems, sentiment, and a quote",
    },
    {
      label: "Push back on an idea",
      prompt: "/ideate ",
      hint: "Describe a change and I'll be frank about it",
      fill: true,
    },
    {
      label: "What should we be asking?",
      prompt: "What questions should we be asking about your experience that we haven't yet?",
      hint: "Research questions I'd want answered",
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
    {
      label: "What would make you stop coming?",
      prompt: "What would make you stop coming to BorderBlend?",
      hint: "The things that would break the habit",
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
      label: "How do you decide where to eat?",
      prompt: "How do you actually decide where to eat when you're hungry?",
      hint: "The (very short) decision process",
    },
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

export function startersForAgent(agentId) {
  return STARTERS_BY_AGENT[agentId] ?? [];
}
