import { useState } from "react";
import { rememberAcknowledgement } from "./acknowledgement.js";
import { TRAINING_EMAIL } from "./links.js";

// Consent screen shown once per browser before any content can leave the page.
//
// The copy states what the code actually does, which is narrower than the usual
// boilerplate in two places and broader in one:
//
//   NOT "a sampling of content is sent to a third-party AI provider" — all of it
//   is. That is how the app works at all.
//
//   NOT "deleted immediately after processing" — submissions are kept for up to
//   30 days so they can be reviewed (api/_reviewLog.js sets the TTL; the daily
//   cron in api/cron/sweep.js deletes the Anthropic-side files).
//
//   It DOES disclose that Urbina Consulting reads and analyses submissions to
//   improve the product. That is the trade for the demo being free, so it is
//   stated in bold rather than buried, and the private-demo alternative is
//   offered in the same breath.
//
// If the retention window or the analysis purpose changes, this copy and the
// ACK_STORAGE_KEY version both have to change — the key bump is what re-asks
// everyone who already accepted the old terms.
const THEME_FALLBACK = {
  "--purple-deep": "#500850",
  "--gold": "#d7a32b",
  "--gold-bright": "#e8bc52",
  "--slate": "#2c3e50",
  "--text-muted": "#667085",
};

export default function AcknowledgementGate({ onAccept }) {
  const [checked, setChecked] = useState(false);

  function accept(e) {
    e?.preventDefault();
    if (!checked) return;
    rememberAcknowledgement();
    onAccept();
  }

  return (
    <div
      style={{
        ...THEME_FALLBACK,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--purple-deep)",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "1.5rem",
      }}
    >
      <form
        onSubmit={accept}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "2rem",
          width: "100%",
          maxWidth: 560,
          boxShadow: "0 12px 40px rgba(0,0,0,.3)",
        }}
      >
        <img
          src="/uc-logo.svg"
          alt="Urbina Consulting"
          style={{ height: 26, width: "auto", marginBottom: "1.25rem", filter: "invert(1)" }}
        />
        <h1
          style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 .9rem", color: "var(--slate)" }}
        >
          Before you start
        </h1>

        <div
          style={{
            fontSize: ".85rem",
            color: "var(--slate)",
            lineHeight: 1.55,
            background: "#fdf8ee",
            border: "1px solid #f0d999",
            borderRadius: 10,
            padding: "1rem 1.1rem",
            margin: "0 0 1.1rem",
          }}
        >
          <p style={{ margin: "0 0 .7rem" }}>
            I acknowledge that this is a <strong>demonstration tool</strong>. Everything I
            type or attach is sent to <strong>Anthropic</strong>, a third-party AI
            provider, to generate responses — all of it, not a sample.
          </p>
          <p style={{ margin: "0 0 .7rem" }}>
            <strong>
              Because this demo is free, Urbina Consulting keeps a copy of what I submit
              &mdash; including any files I attach &mdash; and may read and analyse it to
              improve our products and training.
            </strong>{" "}
            Copies are retained for <strong>up to 30 days</strong> and then deleted. They
            are not sold, published, or shared outside Urbina Consulting.
          </p>
          <p style={{ margin: "0 0 .7rem" }}>
            <strong>So I will not submit anything confidential.</strong> I am responsible
            for ensuring that anything I submit complies with my organisation&rsquo;s
            policies and applicable laws. If I need a demo where submissions are not
            retained or analysed,{" "}
            <a
              href={`mailto:${TRAINING_EMAIL}?subject=${encodeURIComponent("Private ucLoops demo (no retention)")}`}
              style={{ color: "var(--purple-deep)", fontWeight: 700 }}
            >
              I can ask for a private one
            </a>
            .
          </p>
          <p style={{ margin: 0 }}>
            Urbina Consulting assumes no liability for any legal, compliance, or
            confidentiality issues arising from content submitted to this demo.
          </p>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: ".6rem",
            fontSize: ".9rem",
            color: "var(--slate)",
            cursor: "pointer",
            margin: "0 0 1.1rem",
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: ".15rem", width: 17, height: 17, flexShrink: 0, cursor: "pointer" }}
          />
          <span>I have read and accept the above</span>
        </label>

        <button
          type="submit"
          disabled={!checked}
          style={{
            width: "100%",
            background: checked
              ? "linear-gradient(180deg, var(--gold-bright), var(--gold))"
              : "#e5e7eb",
            color: checked ? "var(--purple-deep)" : "#9ca3af",
            border: "none",
            borderRadius: 10,
            padding: ".8rem",
            fontWeight: 700,
            fontSize: ".95rem",
            fontFamily: "inherit",
            cursor: checked ? "pointer" : "default",
          }}
        >
          Start the demo
        </button>
      </form>
    </div>
  );
}
