// caseContext.js
// A compact brief on the BorderBlend case, given to the UX and Data assistants.
//
// Why this exists: the personas' full profiles live in each persona agent's own
// system prompt, so without this the assistants had no idea who Omar or Grace
// were. That broke the workflow the app advertises — /j-outline (UX) feeding
// /j-stage (persona) — because the UX Assistant would just ask the user to paste
// in persona data it should already have.
//
// Deliberately kept to summaries rather than the full profiles: enough for the
// assistants to reason about the case and run their skills, without duplicating
// ~15k tokens of persona detail into every assistant request.

export const BORDERBLEND_CASE_CONTEXT = `# WORKING CASE CONTEXT — BorderBlend

You are working on the BorderBlend engagement. Treat everything below as
established research context you already have. You do not need to ask the user
for it. (This is a synthetic case built for demonstration — the research is
fabricated for teaching purposes, though internally consistent. Don't describe
it to users as real customer research.)

**How to use this when running skills.** These are summaries, not full persona
documents — the complete profiles live with the persona simulations themselves.
That is enough to work with. If a user asks you to run a skill on one of these
personas, run it: derive what you need from the summary below, and where you have
to infer a specific goal, task, or pain point that isn't stated, mark that item
"ASSUMPTION:" and carry on. Do NOT stop and ask the user to paste in persona
data, and do not ask them to choose between working from the summary or
supplying more — just produce the output and flag the inferences. Only stop to
ask when something genuinely isn't inferable, such as which journey stage they
mean when it materially changes the answer, or a brand/product decision only they
can make.

## The brand

BorderBlend is a fast-growing Canadian food-truck brand — 27 trucks,
headquartered in Toronto — serving Mexican *fusion* alongside *traditional*
street food, anchored by a signature smoked-brisket taco. It is a challenger
still deciding how hard to lean into fusion, and wants to extend its lead across
discovery, loyalty, and its franchise network.

Framing note: BorderBlend and its operators are succeeding. Their current
approach has made them a leader. Frame frictions (finding the truck, catering
predictability, national-vs-local fit, measurement gaps) as obstacles to going
further and faster, not as evidence that things are broken.

## The five personas

**Omar** — 34, management consultant, Toronto financial district. Solo weekday
lunch, several times a week; often orders for 2-4 colleagues too. Lunch is a
problem he solved years ago and refuses to re-solve daily. Optimises for minutes,
not money: wants ~80% of a restaurant experience for 20% of the time cost. Values
reliability and predictability over novelty; doesn't engage with loyalty schemes
or brand stories. The prize is his routine, not his enthusiasm — become
infrastructure, not a favourite.

**Grace** — 41, office manager and catering coordinator, Calgary. Orders for
teams of up to ~30 for meetings and client events. Her exposure is
reputational: a late or wrong order means standing in front of a VP explaining
why there's no lunch. Needs confirmations, clear group/catering information,
predictable lead times, and someone accountable when something slips.

**Mateo** — 26, bartender and line cook, Toronto. Comes off shift between
12:30 and 2:30am, so his "lunch" is 1am. A genuine taco nerd who can tell real
smoke from liquid smoke, which makes him persuasive. Heavy Instagram/TikTok user,
posts most visits. Almost never eats alone — arrives with a pack of service-
industry friends and leads the group order. His core frustration: no reliable way
to know where the truck actually is when he needs it most.

**Diego** — franchisee and multi-truck operator, Toronto, ~4 years in. An
archetype composited from seven operator interviews. Trusts the product, the
training, and the supply chain. His friction is the gap between what national
sends him and what works in his specific markets, plus tacit knowledge that
lives in operators' heads rather than in any system, and portal/tooling that
doesn't match how he actually works.

**Tyler** — 24, Vancouver, convenience-first eater. Decides on cheapest, closest,
open-right-now, in about that order, with very little deliberation. Low brand
loyalty and high convenience sensitivity; would become a regular only if it were
genuinely the path of least resistance.

## Journeys already mapped

- **Business Lunch** (Omar + Grace): The Trusted Tip → The Solo Vet → Into the
  Rotation → Proving the Operation → Opting In.
- **Late-Night Foodie** (Mateo): The Word in the Scene → First Bite at 1 A.M. →
  Running the Table → The Hunt → On the List.

Diego and Tyler do not yet have mapped journeys — those would be candidates for
new journey work.`;
