import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PERSONA_META, sourceWordTotal } from "./personaMeta.js";

const EVIDENCE_MAP_URL = "https://urbinaconsulting.com/shares/ucloops/borderblend/";

const THEME = {
  "--purple-deep": "#500850",
  "--purple": "#750675",
  "--slate": "#2c3e50",
  "--slate-2": "#34495e",
  "--gold": "#d7a32b",
  "--gold-bright": "#e8bc52",
  "--amber": "#f59e0b",
  "--bg": "#f5f5f5",
  "--bg-card": "#ffffff",
  "--border": "#e0e0e0",
  "--text": "#1a1a1a",
  "--text-muted": "#667085",
};

const sourceChipStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: ".35rem",
  background: "#fff",
  border: "1px solid #f0d999",
  borderRadius: 999,
  padding: ".3rem .75rem",
  fontSize: ".78rem",
  fontWeight: 600,
  color: "#7a5c0a",
  textDecoration: "none",
};

function emptyConvo() {
  return {
    messages: [],
    token: null,
    turnsUsed: 0,
    turnsMax: 15,
    limitReached: false,
    initialized: false,
    initializing: false,
  };
}

export default function PersonaChat() {
  const [activeId, setActiveId] = useState(PERSONA_META[0].id);
  const [convos, setConvos] = useState(() =>
    Object.fromEntries(PERSONA_META.map((p) => [p.id, emptyConvo()])),
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showSources, setShowSources] = useState(false);
  const scrollRef = useRef(null);
  const initStarted = useRef(new Set());

  const active = PERSONA_META.find((p) => p.id === activeId);
  const convo = convos[activeId];
  const wordTotal = sourceWordTotal(active);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convo.messages.length, activeId, sending, convo.initializing]);

  // Real /initialize priming turn — runs once per persona, before any user
  // message, so the persona's own greeting is genuinely model-generated
  // rather than a static placeholder. Hidden from the transcript, but part
  // of the real message history sent to the API on later turns.
  useEffect(() => {
    if (convo.initialized || convo.initializing || initStarted.current.has(activeId)) return;
    initStarted.current.add(activeId);
    runInitialize(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, convo.initialized, convo.initializing]);

  async function runInitialize(personaId) {
    setConvos((prev) => ({ ...prev, [personaId]: { ...prev[personaId], initializing: true } }));

    const initMsg = { role: "user", content: "/initialize", hidden: true };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId, messages: [initMsg], init: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setConvos((prev) => ({
        ...prev,
        [personaId]: {
          ...prev[personaId],
          messages: [initMsg, { role: "assistant", content: data.reply }],
          token: data.token ?? prev[personaId].token,
          initialized: true,
          initializing: false,
        },
      }));
    } catch (e) {
      // Non-fatal — fall back to a static opener so the user can still chat;
      // the model will still have full context on their first real message.
      setConvos((prev) => ({
        ...prev,
        [personaId]: { ...prev[personaId], initialized: true, initializing: false },
      }));
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending || convo.limitReached || convo.initializing) return;
    setError(null);
    setDraft("");

    const userMsg = { role: "user", content: text };
    const historyForApi = [...convo.messages, userMsg];

    setConvos((prev) => ({
      ...prev,
      [activeId]: { ...prev[activeId], messages: historyForApi },
    }));
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: activeId,
          messages: historyForApi,
          token: convo.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      setConvos((prev) => {
        const prevConvo = prev[activeId];
        const nextMessages = data.limitReached && !data.reply
          ? prevConvo.messages
          : [...historyForApi, { role: "assistant", content: data.reply }];
        return {
          ...prev,
          [activeId]: {
            ...prevConvo,
            messages: nextMessages,
            token: data.token ?? prevConvo.token,
            turnsUsed: data.turnsUsed ?? prevConvo.turnsUsed,
            turnsMax: data.turnsMax ?? prevConvo.turnsMax,
            limitReached: !!data.limitReached,
          },
        };
      });
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  function resetConversation() {
    initStarted.current.delete(activeId);
    setConvos((prev) => ({ ...prev, [activeId]: emptyConvo() }));
    setError(null);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ ...THEME, display: "flex", flexDirection: "column", height: "100vh", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "var(--bg)" }}>
      <div
        style={{
          background: "var(--slate)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: ".6rem",
          padding: ".4rem .7rem",
          boxShadow: "0 3px 10px rgba(0,0,0,.18)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <a
          href={EVIDENCE_MAP_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#cdd7e0",
            textDecoration: "none",
            fontSize: ".82rem",
            fontWeight: 600,
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: ".4rem",
          }}
        >
          <span>←</span>
          <span>Back to BorderBlend Evidence Map</span>
        </a>
        <button
          onClick={() => setShowSources((v) => !v)}
          style={{
            background: "var(--amber)",
            color: "var(--slate)",
            border: "none",
            borderRadius: 6,
            padding: ".32rem .7rem",
            fontSize: ".74rem",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Sources &amp; evidence {showSources ? "▲" : "▼"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          background: "var(--slate)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem", marginBottom: ".4rem" }}>
            <img src="/uc-logo.svg" alt="Urbina Consulting" style={{ height: 22, width: "auto" }} />
          </div>
          <h1 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0, letterSpacing: ".01em" }}>
            ucLoops Persona Simulator
          </h1>
          <p style={{ fontSize: ".76rem", color: "rgba(255,255,255,.65)", margin: ".35rem 0 0" }}>
            BorderBlend engagement · synthetic case
          </p>
        </div>

        <div style={{ padding: ".75rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {PERSONA_META.map((p) => {
            const isActive = p.id === activeId;
            const c = convos[p.id];
            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveId(p.id);
                  setShowSources(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: ".7rem",
                  padding: ".65rem .7rem",
                  borderRadius: 10,
                  border: isActive ? "1px solid var(--gold)" : "1px solid transparent",
                  background: isActive ? "var(--slate-2)" : "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background .15s, border-color .15s",
                }}
              >
                <span style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={p.avatar}
                    alt={p.name}
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      objectFit: "cover",
                      display: "block",
                      border: "2px solid rgba(255,255,255,.2)",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      background: "var(--gold)",
                      color: "var(--purple-deep)",
                      fontSize: ".55rem",
                      fontWeight: 800,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid var(--slate)",
                    }}
                  >
                    {p.initial}
                  </span>
                </span>
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontSize: ".9rem", fontWeight: 600 }}>{p.name}</div>
                  <div
                    style={{
                      fontSize: ".72rem",
                      color: "rgba(255,255,255,.62)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.role}
                  </div>
                  {c.turnsUsed > 0 && (
                    <div style={{ fontSize: ".65rem", color: "var(--gold-bright)", marginTop: 2 }}>
                      {c.turnsUsed}/{c.turnsMax} messages
                    </div>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            background: "var(--purple-deep)",
            color: "#fff",
            padding: "1rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{active.name}</div>
            <div style={{ fontSize: ".8rem", color: "rgba(255,255,255,.75)" }}>{active.role} · {active.detail}</div>
          </div>
          <div style={{ display: "flex", gap: ".6rem", flexShrink: 0 }}>
            <button
              onClick={resetConversation}
              style={{
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.3)",
                color: "#fff",
                borderRadius: 999,
                padding: ".4rem 1rem",
                fontSize: ".78rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              New conversation
            </button>
          </div>
        </header>

        {showSources && (
          <div
            style={{
              background: "#fdf8ee",
              borderBottom: "2px solid var(--gold)",
              padding: "1rem 1.5rem",
              fontSize: ".85rem",
              color: "#4a3b0a",
              flexShrink: 0,
            }}
          >
            <div style={{ maxWidth: 720, margin: "0 auto" }}>
              <p style={{ margin: "0 0 .6rem", fontWeight: 600 }}>
                {active.name} is grounded in {active.sources.length} interview
                {active.sources.length === 1 ? "" : "s"} (~{wordTotal.toLocaleString()} words of verbatim
                research), plus the full BorderBlend {active.journeyLabel ? "persona profile and journey map" : "persona profile"}.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                <a
                  href={active.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...sourceChipStyle }}
                >
                  🏷️ Full persona profile
                </a>
                {active.journeyUrl && (
                  <a
                    href={active.journeyUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...sourceChipStyle }}
                  >
                    🗺️ {active.journeyLabel}
                  </a>
                )}
                {active.sources.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ ...sourceChipStyle }}
                  >
                    🎙️ {s.label} · {s.words.toLocaleString()}w
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {convo.initializing && (
            <div
              style={{
                maxWidth: 520,
                margin: "2rem auto",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: ".92rem",
                lineHeight: 1.6,
              }}
            >
              <img
                src={active.avatar}
                alt={active.name}
                style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", margin: "0 auto 1rem" }}
              />
              Getting to know {active.name}…
            </div>
          )}

          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {convo.messages.filter((m) => !m.hidden).map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  gap: ".6rem",
                }}
              >
                {m.role === "assistant" && (
                  <img
                    src={active.avatar}
                    alt={active.name}
                    style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                )}
                <div
                  className={m.role === "user" ? "bubble-user" : "bubble-assistant"}
                  style={{
                    maxWidth: "75%",
                    padding: ".7rem 1rem",
                    borderRadius: 14,
                    background: m.role === "user" ? "var(--purple-deep)" : "var(--bg-card)",
                    color: m.role === "user" ? "#fff" : "var(--text)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                    fontSize: ".92rem",
                    lineHeight: 1.55,
                    boxShadow: m.role === "user" ? "none" : "0 1px 3px rgba(0,0,0,.05)",
                  }}
                >
                  <div className="md-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ display: "flex", gap: ".6rem" }}>
                <img
                  src={active.avatar}
                  alt={active.name}
                  style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
                <div
                  style={{
                    padding: ".7rem 1rem",
                    borderRadius: 14,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    fontSize: ".85rem",
                  }}
                >
                  {active.name} is typing…
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-card)", padding: "1rem 1.5rem", flexShrink: 0 }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            {error && (
              <div style={{ color: "#b91c1c", fontSize: ".82rem", marginBottom: ".5rem" }}>{error}</div>
            )}
            {convo.limitReached ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  padding: ".8rem 1rem",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: 10,
                  fontSize: ".85rem",
                  color: "#92400e",
                }}
              >
                <span>You've reached the {convo.turnsMax}-message limit for this conversation.</span>
                <button
                  onClick={resetConversation}
                  style={{
                    background: "linear-gradient(180deg,var(--gold-bright),var(--gold))",
                    color: "var(--purple-deep)",
                    border: "none",
                    borderRadius: 999,
                    padding: ".45rem 1.1rem",
                    fontWeight: 700,
                    fontSize: ".8rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Start new
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: ".6rem", alignItems: "flex-end" }}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={convo.initializing ? `${active.name} is getting ready…` : `Message ${active.name}…`}
                  rows={1}
                  disabled={sending || convo.initializing}
                  style={{
                    flex: 1,
                    resize: "none",
                    padding: ".7rem .9rem",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    fontFamily: "inherit",
                    fontSize: ".92rem",
                    outline: "none",
                    maxHeight: 120,
                  }}
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim() || convo.initializing}
                  style={{
                    background: "linear-gradient(180deg,var(--gold-bright),var(--gold))",
                    color: "var(--purple-deep)",
                    border: "none",
                    borderRadius: 10,
                    padding: ".7rem 1.4rem",
                    fontWeight: 700,
                    fontSize: ".9rem",
                    cursor: sending || !draft.trim() || convo.initializing ? "default" : "pointer",
                    opacity: sending || !draft.trim() || convo.initializing ? 0.55 : 1,
                    flexShrink: 0,
                  }}
                >
                  Send
                </button>
              </div>
            )}
            <div style={{ fontSize: ".7rem", color: "var(--text-muted)", marginTop: ".5rem" }}>
              {convo.turnsUsed}/{convo.turnsMax} messages used in this conversation
            </div>
          </div>
        </div>
      </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        textarea::placeholder { color: #9ca3af; }
        .md-content { min-width: 0; }
        .md-content > *:first-child { margin-top: 0; }
        .md-content > *:last-child { margin-bottom: 0; }
        .md-content h1, .md-content h2, .md-content h3 {
          font-size: .95rem; font-weight: 700; margin: .9rem 0 .4rem; color: inherit;
        }
        .md-content hr { border: none; border-top: 1px solid rgba(0,0,0,.12); margin: .8rem 0; }
        .md-content p { margin: 0 0 .6rem; }
        .md-content ul, .md-content ol { margin: 0 0 .6rem; padding-left: 1.2rem; }
        .md-content li { margin-bottom: .25rem; }
        .md-content strong { font-weight: 700; }
        .md-content code { background: rgba(0,0,0,.06); padding: .1rem .3rem; border-radius: 4px; font-size: .85em; }
        .md-content a { color: var(--gold); font-weight: 600; text-decoration: underline; }
        .bubble-user .md-content a { color: var(--gold-bright); }
      `}</style>
    </div>
  );
}
