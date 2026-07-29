// workflow.js
// The ucLoops process as a sequence of loops, and which agent runs which skill
// at each one. Drives the "How it works" diagram.
//
// Availability badges are NOT stored here — the diagram reads them from
// DISABLED_COMMANDS in skills.js, so enabling a skill in one place updates the
// agents, the skills panel, and this diagram together.

export const WORKFLOW_LOOPS = [
  {
    n: 1,
    title: "Ingest",
    agent: "Data Assistant",
    agentId: "data",
    what: "Raw research goes in — interviews, meeting notes, support logs, survey text — and comes out structured, with verbatims and speakers preserved.",
    skills: ["/transcript-cleanup", "/create-index", "/clean-index"],
    produces: "Clean transcripts · an indexed dataset with traceable item IDs",
  },
  {
    n: 2,
    title: "Organise",
    agent: "Data Assistant",
    agentId: "data",
    what: "Patterns across the research become personas — either synthesised from what you supplied, or proposed for a scenario when you have no research yet.",
    skills: ["/personas", "/persona-export"],
    produces: "Persona set · a full persona document per persona",
  },
  {
    n: 3,
    title: "Simulate",
    agent: "Persona Simulations",
    agentId: "omar",
    what: "Each persona becomes something you can talk to. It answers in first person from its own research, and will push back rather than agree with you.",
    skills: ["/initialize", "/ideate"],
    produces: "A persona you can interview, challenge, and test ideas against",
  },
  {
    n: 4,
    title: "Outline",
    agent: "UX Assistant",
    agentId: "ux",
    what: "The shape of the journey: where it starts, where it ends, the stages between, and the decision gates that move someone forward.",
    skills: ["/j-outline", "/j-multi-outline", "/j-multi-dialogue"],
    produces: "Journey outline · multi-persona journey · simulated dialogue",
  },
  {
    n: 5,
    title: "Map stages",
    agent: "Persona Simulations",
    agentId: "omar",
    what: "Back to the persona to fill each stage in their own voice — goals, narrative, problems, tasks, sentiment, and a quote that sounds like them.",
    skills: ["/j-stage", "/j-questions"],
    produces: "Stage-by-stage journey content, grounded in the source research",
  },
  {
    n: 6,
    title: "Enrich",
    agent: "UX Assistant",
    agentId: "ux",
    what: "Now the brand's side of the journey: what to offer at each stage, and what data each stage generates or could draw on.",
    skills: ["/j-suggest", "/j-data"],
    produces: "Opportunities · content assets · CTAs · entry & transition signals · data model",
  },
  {
    n: 7,
    title: "Extract",
    agent: "UX Assistant",
    agentId: "ux",
    what: "Turn the journey and personas into something a team can act on, with the traceability back to source intact.",
    skills: ["/stories"],
    produces: "User stories with acceptance criteria, sources, and priority signals",
  },
  {
    n: 8,
    title: "Publish",
    agent: "Any agent",
    agentId: null,
    what: "Render the work as standalone, styled deliverables you can share with people who were never in the room.",
    skills: ["/p-create-page", "/j-create-page", "/summary", "/sticky"],
    produces: "HTML persona profiles · HTML journey maps · summaries · sticky notes",
  },
];

// Skills that apply throughout rather than at one loop.
export const CROSS_CUTTING = {
  title: "Available at every loop",
  skills: [
    { command: "/help", note: "See what the current agent can do" },
    { command: "/learn", note: "Add context mid-conversation" },
    { command: "/sticky", note: "Reformat any output as whiteboard stickies" },
    { command: "/summary", note: "Capture the conversation as a document" },
  ],
};

export const LOOP_BACK_NOTE =
  "Outputs from any loop become inputs to the next run — a persona export feeds the journey work, a journey map feeds the next round of research questions. Humans are the loop in ucLoops: each pass leaves the next one better grounded in real human research (although you can use AI to fill in some gaps).";
