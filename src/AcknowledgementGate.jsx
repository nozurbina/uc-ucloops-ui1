import { useState } from "react";
import { rememberAcknowledgement } from "./acknowledgement.js";

// Consent screen shown once per browser before any content can leave the page.
//
// The copy is deliberately narrower than the usual boilerplate, because two of the
// common claims are not true of this app and would be misleading:
//
//   "content is deleted after processing" — attachments go to the Anthropic Files
//   API and stay there. Nothing in this codebase deletes them.
//
//   "a sampling of content is sent to a third-party AI provider" — all of it is.
//   That is how the app works at all.
//
// If file deletion is implemented later, the attachment sentence can be softened —
// but not before.
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
            Urbina Consulting does not store, share, or repurpose my conversations. They
            exist only in this browser session and are gone when I close or reload the
            page. Only anonymous usage counters are kept, to enforce this demo&rsquo;s
            limits.
          </p>
          <p style={{ margin: "0 0 .7rem" }}>
            <strong>
              Files I attach are uploaded to Anthropic&rsquo;s file storage and are not
              deleted automatically, so I will not attach confidential material.
            </strong>{" "}
            The demo works without attachments.
          </p>
          <p style={{ margin: 0 }}>
            I am responsible for ensuring that anything I submit complies with my
            organisation&rsquo;s policies and applicable laws. Urbina Consulting assumes no
            liability for any legal, compliance, or confidentiality issues arising from
            content submitted to this demo.
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
