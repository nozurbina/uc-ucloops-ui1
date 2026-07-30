// Outbound links shared by more than one component.
//
// These live in their own module rather than in AgentChat.jsx because
// WorkflowDiagram.jsx needs them too, and AgentChat already imports
// WorkflowDiagram — putting them there would make the import circular.

// The promo banner on the BorderBlend deliverables site points here, so both
// surfaces send people to the same place. The trailing slash matches that
// banner's href exactly.
export const COURSES_URL =
  "https://urbinaconsulting.com/shares/ucloops/cohort-journeys-sept-2026/";

export const TRAINING_EMAIL = "ucloops@urbinaconsulting.com";
