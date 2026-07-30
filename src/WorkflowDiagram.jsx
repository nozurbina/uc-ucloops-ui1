import { WORKFLOW_LOOPS, CROSS_CUTTING, LOOP_BACK_NOTE } from "./workflow.js";
import { isDisabled } from "./skills.js";

const AGENT_COLOUR = {
  data: "#0b6a5b",
  ux: "#3131bf",
  omar: "#750675", // stands for the persona simulations generally
  null: "#667085",
};

// Shared by the three intro paragraphs, which are styled identically.
const INTRO_P = {
  margin: "0 0 1rem",
  fontSize: ".84rem",
  color: "var(--text-muted)",
  lineHeight: 1.55,
};

function SkillPill({ command, onPick }) {
  const off = isDisabled(command);
  return (
    <button
      onClick={() => !off && onPick?.(command)}
      disabled={off}
      title={off ? "Not available in the free demo" : "Insert into the message box"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ".3rem",
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        fontSize: ".72rem",
        fontWeight: 700,
        padding: ".2rem .45rem",
        borderRadius: 5,
        border: off ? "1px dashed #d6c9a8" : "1px solid #e3dced",
        background: off ? "#fdf8ee" : "#fff",
        color: off ? "#92400e" : "var(--purple)",
        cursor: off ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {command}
      {off && <span style={{ fontWeight: 800, fontSize: ".6rem" }}>✕</span>}
    </button>
  );
}

export default function WorkflowDiagram({ onPickSkill }) {
  const disabledCount = WORKFLOW_LOOPS.flatMap((l) => l.skills).filter(isDisabled).length;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <p
        style={{
          margin: "0 0 .35rem",
          fontSize: ".95rem",
          fontWeight: 600,
          color: "var(--slate)",
        }}
      >
        Welcome to the ucLoops demo app
      </p>
      <p style={INTRO_P}>
        ucLoops is an AI methodology you can use on your own machine with no software besides the AI tools (Claude, ChatGPT, Grok, etc) that you use today. It is a strategy and experience design system that supports working real evidence, augmented by AI when there are gaps.
      </p>
      <p style={INTRO_P}>
        People use it to create strategies and designs for marketing, sales, knowledge, content, and product experience. Each stage of the workflow is a loop that hands off its output to the next. Different agents support different
        loops. You can switch between agents in the sidebar.
      </p>
      <p style={INTRO_P}>
        <strong>Humans are the loop.</strong> You're always in control and can decide how much of the results are anchored in your data or generated with AI and how much analysis is hands-on vs automated.
      </p>
      <p style={INTRO_P}>
        <strong>This demo content is synthetic. Although we strongly advocate the use of <a href="https://urbinaconsulting.com/ai/synthetic-users-vs-persona-simulations/">real research for simulating personas</a>, all data in this demo is AI-generated.</strong>
      </p>

      {disabledCount > 0 && (
        <div
          style={{
            display: "flex",
            gap: ".6rem",
            alignItems: "flex-start",
            background: "#fdf8ee",
            border: "1px solid #f0d999",
            borderRadius: 10,
            padding: ".7rem .9rem",
            marginBottom: "1.1rem",
            fontSize: ".82rem",
            color: "#7a5c0a",
            lineHeight: 1.5,
          }}
        >
          {/* The left column is one glyph wide by design, so the label belongs in
              the text column as a heading — putting it beside the ✕ collapses it
              into a three-line stack at any width the intro actually gets. */}
          <span style={{ fontWeight: 800, flexShrink: 0 }}>✕</span>
          <span>
            <strong style={{ display: "block" }}>Disabled skills</strong>
            Skills marked with an ✕ are switched off in this free demo. The agents
            will still explain what each one does and when you'd reach for it, they
            just won't produce the deliverable. Everything else works normally.
          </span>
        </div>
      )}

      {WORKFLOW_LOOPS.map((loop, i) => {
        const colour = AGENT_COLOUR[loop.agentId] ?? AGENT_COLOUR.null;
        return (
          <div key={loop.n}>
            <div
              style={{
                display: "flex",
                gap: ".9rem",
                background: "#fff",
                border: "1px solid var(--border)",
                borderLeft: `4px solid ${colour}`,
                borderRadius: 10,
                padding: ".8rem .95rem",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: colour,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: ".78rem",
                  fontWeight: 800,
                }}
              >
                {loop.n}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: ".5rem",
                    flexWrap: "wrap",
                    marginBottom: ".3rem",
                  }}
                >
                  <span style={{ fontSize: ".95rem", fontWeight: 700, color: "var(--slate)" }}>
                    {loop.title}
                  </span>
                  <span
                    style={{
                      fontSize: ".68rem",
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                      color: colour,
                      background: `${colour}14`,
                      border: `1px solid ${colour}33`,
                      borderRadius: 999,
                      padding: ".1rem .45rem",
                    }}
                  >
                    {loop.agent}
                  </span>
                </div>
                <p
                  style={{
                    margin: "0 0 .45rem",
                    fontSize: ".84rem",
                    color: "var(--text)",
                    lineHeight: 1.5,
                  }}
                >
                  {loop.what}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: ".3rem",
                    marginBottom: ".4rem",
                  }}
                >
                  {loop.skills.map((c) => (
                    <SkillPill key={c} command={c} onPick={onPickSkill} />
                  ))}
                </div>
                <div style={{ fontSize: ".74rem", color: "var(--text-muted)" }}>
                  <strong style={{ fontWeight: 600 }}>Out:</strong> {loop.produces}
                </div>
              </div>
            </div>

            {i < WORKFLOW_LOOPS.length - 1 && (
              <div
                style={{
                  height: 18,
                  marginLeft: "1.55rem",
                  borderLeft: "2px solid #ddd",
                }}
              />
            )}
          </div>
        );
      })}

      {/* The loop-back */}
      <div
        style={{
          marginTop: ".9rem",
          background: "linear-gradient(135deg,#f7f2fa,#fdf8ee)",
          border: "1px solid #e2d4e8",
          borderRadius: 10,
          padding: ".8rem .95rem",
          fontSize: ".83rem",
          color: "var(--slate)",
          lineHeight: 1.55,
        }}
      >
        <span style={{ fontWeight: 700 }}>↻ And back round.</span> {LOOP_BACK_NOTE}
      </div>

      {/* Cross-cutting skills */}
      <div style={{ marginTop: "1rem" }}>
        <div
          style={{
            fontSize: ".66rem",
            fontWeight: 700,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: ".5rem",
          }}
        >
          {CROSS_CUTTING.title}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          {CROSS_CUTTING.skills.map((s) => (
            <span
              key={s.command}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: ".4rem",
                fontSize: ".76rem",
                color: "var(--text-muted)",
              }}
            >
              <SkillPill command={s.command} onPick={onPickSkill} />
              {s.note}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
