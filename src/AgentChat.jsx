import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AGENT_META,
  PERSONA_META,
  ASSISTANT_META,
  getAgentMeta,
  sourceWordTotal,
  EVIDENCE_MAP_URL,
} from "./agentMeta.js";
import { skillsForAgent, groupedSkillsForAgent, WORKFLOW_CHAIN } from "./skills.js";
import { startersForAgent } from "./starters.js";
import { COURSES_URL } from "./links.js";
import ContactEmail from "./ContactEmail.jsx";
import AcknowledgementGate from "./AcknowledgementGate.jsx";
import { hasAcknowledged } from "./acknowledgement.js";
import WorkflowDiagram from "./WorkflowDiagram.jsx";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 1024 * 1024;

/**
 * `?agent=<id>` deep link, used by the evidence-map site so a persona page or a
 * journey sidebar can open straight into a conversation with that persona.
 * Returns null for a missing or unrecognised id, which lands on the overview
 * instead — a bad link should never boot into the wrong persona.
 */
function readAgentFromUrl() {
  if (typeof window === "undefined") return null;
  try {
    const id = new URLSearchParams(window.location.search).get("agent");
    if (!id) return null;
    return AGENT_META.some((a) => a.id === id) ? id : null;
  } catch {
    return null;
  }
}

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

const chipStyle = {
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

const barButtonStyle = {
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
};

// Inline styles can't carry media queries, so the breakpoint is observed in JS
// and drives the same style objects everything else uses.
function useIsNarrow(breakpoint = 860) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setNarrow(mq.matches);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return narrow;
}

/**
 * A height-capped scroll area that shows where there's more content.
 *
 * Fades appear only on the edges that actually have content beyond them, so a
 * panel that fits entirely gets no decoration at all — the affordance is a
 * signal, not permanent furniture. Measured via ResizeObserver as well as
 * onScroll, because panel content changes height when you switch agents.
 */
function ScrollPanel({ maxHeight, fadeColor, padding, style, children }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ overflowing: false, atTop: true, atBottom: true });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      overflowing: el.scrollHeight > el.clientHeight + 2,
      atTop: el.scrollTop <= 2,
      atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
    });
  };

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Observe the inner content too — switching agents changes its height
    // without any scroll or window resize happening.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [children]);

  const fade = (edge) => ({
    position: "absolute",
    left: 0,
    right: 0,
    [edge]: 0,
    height: edge === "bottom" ? 46 : 28,
    pointerEvents: "none",
    background: `linear-gradient(to ${edge}, transparent, ${fadeColor})`,
  });

  return (
    <div style={{ position: "relative", minHeight: 0, ...style }}>
      <div
        ref={ref}
        onScroll={measure}
        className="uc-scroll"
        style={{ maxHeight, overflowY: "auto", padding }}
      >
        {children}
      </div>

      {edges.overflowing && !edges.atTop && <div style={fade("top")} />}
      {edges.overflowing && !edges.atBottom && (
        <>
          <div style={fade("bottom")} />
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              background: "var(--slate)",
              color: "#fff",
              borderRadius: 999,
              padding: ".16rem .6rem",
              fontSize: ".66rem",
              fontWeight: 700,
              letterSpacing: ".04em",
              opacity: 0.82,
              whiteSpace: "nowrap",
            }}
          >
            scroll for more ↓
          </div>
        </>
      )}
    </div>
  );
}

function emptyConvo(maxTurns) {
  return {
    messages: [],
    token: null,
    turnsUsed: 0,
    turnsMax: maxTurns,
    limitReached: false,
    initialized: false,
    initializing: false,
    // Fixes which questions get rotated into the starters for this
    // conversation. Set once here so the cards stay put while you type, and
    // change only when a new conversation begins.
    starterSeed: Math.random(),
    // Groups this conversation's turns into one reviewable record server-side.
    // Not an identity: it's random per conversation, resets with "New
    // conversation", and is never tied to a person or browser.
    conversationId: newConversationId(),
  };
}

function newConversationId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function initialConvos() {
  return Object.fromEntries(AGENT_META.map((a) => [a.id, emptyConvo(a.maxTurns)]));
}

function AgentAvatar({ agent, size = 42, ring = true }) {
  if (agent.avatar) {
    return (
      <img
        src={agent.avatar}
        alt={agent.name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          border: ring ? "2px solid rgba(255,255,255,.2)" : "none",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: agent.accent ?? "var(--slate-2)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.34,
        fontWeight: 800,
        letterSpacing: ".02em",
        border: ring ? "2px solid rgba(255,255,255,.2)" : "none",
        flexShrink: 0,
      }}
    >
      {agent.initial}
    </div>
  );
}

function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e?.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not verify that password.");
      onUnlock();
    } catch (err) {
      setError(err.message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        ...THEME,
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
        onSubmit={submit}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "2rem",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 12px 40px rgba(0,0,0,.3)",
        }}
      >
        <img
          src="/uc-logo.svg"
          alt="Urbina Consulting"
          style={{ height: 26, width: "auto", marginBottom: "1.25rem", filter: "invert(1)" }}
        />
        <h1 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0 0 .4rem", color: "var(--slate)" }}>
          ucLoops Persona Simulator
        </h1>
        <p style={{ fontSize: ".88rem", color: "var(--text-muted)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
          This demo is password-protected. Enter the password you were given to continue.
        </p>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: ".7rem .9rem",
            borderRadius: 10,
            border: "1px solid var(--border)",
            fontSize: ".95rem",
            fontFamily: "inherit",
            outline: "none",
            marginBottom: error ? ".5rem" : "1rem",
          }}
        />
        {error && (
          <div style={{ color: "#b91c1c", fontSize: ".82rem", marginBottom: "1rem" }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={busy || !password.trim()}
          style={{
            width: "100%",
            background: "linear-gradient(180deg,var(--gold-bright),var(--gold))",
            color: "var(--purple-deep)",
            border: "none",
            borderRadius: 10,
            padding: ".75rem",
            fontWeight: 700,
            fontSize: ".95rem",
            cursor: busy || !password.trim() ? "default" : "pointer",
            opacity: busy || !password.trim() ? 0.55 : 1,
          }}
        >
          {busy ? "Checking…" : "Enter demo"}
        </button>
        <p style={{ fontSize: ".76rem", color: "var(--text-muted)", margin: "1rem 0 0", textAlign: "center" }}>
          Need access? Contact{" "}
          <ContactEmail
            subject="ucLoops demo access"
            style={{ color: "var(--purple)", cursor: "pointer" }}
          />
        </p>
      </form>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #9ca3af; }
      `}</style>
    </div>
  );
}

export default function AgentChat() {
  const [gate, setGate] = useState({ checked: false, locked: false });
  // Read synchronously on first render so an already-consenting visitor never sees
  // the notice flash before it disappears.
  const [acknowledged, setAcknowledged] = useState(hasAcknowledged);
  // Read once on mount. A deep link names the agent; without one we start on the
  // overview, so `activeId` is only a fallback for when the user picks nothing.
  const [deepLinked] = useState(readAgentFromUrl);
  const [activeId, setActiveId] = useState(deepLinked ?? PERSONA_META[0].id);
  const [convos, setConvos] = useState(initialConvos);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showSources, setShowSources] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  // The overview is the default view: arriving cold, the loops are what make the
  // agent list legible. A deep link means the choice is already made, so it goes
  // straight to that agent's chat.
  const [landing, setLanding] = useState(!deepLinked);
  const isNarrow = useIsNarrow();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  // { personalCap: bool } when the demo's shared daily allowance is spent.
  const [demoCap, setDemoCap] = useState(null);
  const [skillQuery, setSkillQuery] = useState(null); // null = popup closed
  const [skillIndex, setSkillIndex] = useState(0);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const initStarted = useRef(new Set());

  const active = getAgentMeta(activeId);
  const convo = convos[activeId];
  const wordTotal = sourceWordTotal(active);
  const skills = skillsForAgent(activeId);
  const skillGroups = groupedSkillsForAgent(activeId);

  // Skills matching what's been typed after "/" in the message box.
  const skillMatches = useMemo(() => {
    if (skillQuery === null) return [];
    const q = skillQuery.toLowerCase();
    return skills.filter((s) => s.command.toLowerCase().startsWith("/" + q)).slice(0, 8);
  }, [skillQuery, skills]);

  // Transcript scroll state. `overflowing` and `atBottom` drive the "more below"
  // affordance; `atBottom` also decides whether new content gets followed.
  const [transcript, setTranscript] = useState({ overflowing: false, atBottom: true });

  // A greeting is the agent talking about itself, not an exchange. Until the user
  // has actually said something the transcript stays pinned to the top: the intro
  // runs well past a phone viewport, so jumping to the bottom drops the reader
  // mid-sentence with the opening line already scrolled off.
  const userHasSpoken = useMemo(
    () => convo.messages.some((m) => m.role === "user" && !m.hidden),
    [convo.messages],
  );

  // Whether the transcript should stay stuck to the end as content grows. A ref,
  // not state, because the ResizeObserver needs the current value without being
  // re-subscribed on every change.
  const followRef = useRef(false);

  const measureTranscript = () => {
    const el = scrollRef.current;
    if (!el) return false;
    // Deliberately loose — "keeping up with the conversation" shouldn't mean being
    // pixel-exact at the end, and momentum scrolling rarely lands there.
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    setTranscript({ overflowing: el.scrollHeight > el.clientHeight + 2, atBottom });
    return atBottom;
  };

  const lastScrollTopRef = useRef(0);

  // Only *direction* is a reliable signal of intent. Growing content fires scroll
  // events too, and at that instant we're no longer at the bottom — so keying off
  // "am I at the bottom" alone made the transcript stop following a conversation
  // the reader had never scrolled away from. Growth leaves scrollTop untouched, so:
  // moving up means they want to read back, and arriving at the end means they've
  // caught up again.
  const handleTranscriptScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = measureTranscript();
    if (el.scrollTop < lastScrollTopRef.current - 2) followRef.current = false;
    else if (atBottom) followRef.current = true;
    lastScrollTopRef.current = el.scrollTop;
  };

  const scrollTranscriptToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  // Sending is an explicit act, so it always wins over the rules below: you
  // expect to see the message you just sent. Without this, sending from the
  // pinned-top greeting would look like nothing happened, because the reader
  // isn't at the bottom at that moment.
  const lastMessage = convo.messages[convo.messages.length - 1];
  const justSent = lastMessage?.role === "user" && !lastMessage.hidden;

  // Otherwise two regimes: pinned to the top while the agent is only introducing
  // itself, and following new content once a conversation is underway — the latter
  // only if the reader hasn't scrolled away, so going back to re-read an earlier
  // answer isn't yanked away by the next reply arriving.
  //
  // The decision reads followRef, not the measured atBottom. Measured position goes
  // stale the moment content grows underneath us: the "is typing" indicator is
  // ~125px, so by the time the reply arrived we no longer looked "at the bottom"
  // and stopped following a conversation the reader never left. followRef only
  // changes on an actual scroll event, which is the real signal of intent.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (justSent || (userHasSpoken && followRef.current)) {
      el.scrollTop = el.scrollHeight;
      followRef.current = true;
    } else if (!userHasSpoken) {
      el.scrollTop = 0;
      followRef.current = false;
    }
    lastScrollTopRef.current = el.scrollTop;
    measureTranscript();
  }, [convo.messages.length, activeId, sending, convo.initializing, userHasSpoken, justSent]);

  // Content height changes with no scroll or window resize of its own: markdown
  // reflows as web fonts settle, and switching agents swaps the whole transcript.
  // Observing the children as well as the container catches both, so the affordance
  // doesn't depend on the user scrolling to discover it.
  //
  // It also has to re-pin. Growth that lands *after* the scroll effect has run
  // would otherwise leave the transcript short of the end — on a slow load that was
  // reproducibly ~125px, which reads as "the reply arrived but I can't see it".
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const node = scrollRef.current;
      if (!node) return;
      if (followRef.current) {
        node.scrollTop = node.scrollHeight;
        lastScrollTopRef.current = node.scrollTop;
      }
      measureTranscript();
    });
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
    // `sending` is in here because it adds the "is typing" row: without it that
    // child is never observed and its height change goes unnoticed.
  }, [activeId, convo.messages.length, convo.initializing, sending]);

  // Ask the server whether a password is required and whether this browser has
  // already satisfied it (the gate cookie is httpOnly, so only the server knows).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setGate({ checked: true, locked: Boolean(d.gateEnabled) && !d.unlocked });
        }
      })
      .catch(() => {
        // If the check itself fails, don't hard-lock the UI — the API routes
        // enforce the gate independently, so the worst case is a 401 later.
        if (!cancelled) setGate({ checked: true, locked: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real /start priming turn — runs once per agent, before any user
  // message, so the greeting is genuinely model-generated from the agent's own
  // template rather than a static placeholder. Hidden from the visible
  // transcript, but part of the history sent to the API on later turns.
  useEffect(() => {
    // Wait for the gate check — priming while locked would just burn a 401.
    if (!gate.checked || gate.locked) return;
    // Consent gates the very first request too: the priming turn sends this
    // persona's whole system prompt to Anthropic, so it must not fire beforehand.
    if (!acknowledged) return;
    // On the overview no agent has been chosen yet. Priming here would spend a
    // real API call on a persona the visitor may never open.
    if (landing) return;
    // Once the demo allowance is spent, don't keep firing priming calls for
    // every agent the user clicks through.
    if (demoCap) return;
    if (convo.initialized || convo.initializing || initStarted.current.has(activeId)) return;
    initStarted.current.add(activeId);
    runInitialize(activeId);
  }, [
    activeId,
    convo.initialized,
    convo.initializing,
    gate.checked,
    gate.locked,
    demoCap,
    landing,
    acknowledged,
  ]);

  async function runInitialize(agentId) {
    setConvos((prev) => ({ ...prev, [agentId]: { ...prev[agentId], initializing: true } }));
    const initMsg = { role: "user", content: "/start", hidden: true };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, messages: [initMsg], init: true }),
      });
      const data = await res.json();
      if (res.status === 401 && data.locked) {
        setGate({ checked: true, locked: true });
        setConvos((prev) => ({
          ...prev,
          [agentId]: { ...prev[agentId], initializing: false },
        }));
        return;
      }
      if (data.demoCapReached) {
        setDemoCap({ personalCap: Boolean(data.personalCap) });
        setConvos((prev) => ({
          ...prev,
          [agentId]: { ...prev[agentId], initialized: true, initializing: false },
        }));
        return;
      }
      if (!res.ok) throw new Error(data.error || "Request failed");

      setConvos((prev) => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          messages: [initMsg, { role: "assistant", content: data.reply }],
          token: data.token ?? prev[agentId].token,
          turnsUsed: data.turnsUsed ?? prev[agentId].turnsUsed,
          initialized: true,
          initializing: false,
        },
      }));
    } catch {
      // Non-fatal: let the user chat anyway — the model still gets full
      // context on their first real message.
      setConvos((prev) => ({
        ...prev,
        [agentId]: { ...prev[agentId], initialized: true, initializing: false },
      }));
    }
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setError(null);

    if (attachments.length + files.length > MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} files per message in this demo.`);
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setError(
        `"${tooBig.name}" is ${(tooBig.size / 1024 / 1024).toFixed(1)}MB — attachments are limited to 1MB each in this demo.`,
      );
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const dataBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.readAsDataURL(file);
        });

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, dataBase64 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        setAttachments((prev) => [...prev, data]);
      }
    } catch (e) {
      setError(e.message || "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // `overrideText` lets a conversation starter send directly without first
  // round-tripping through the composer's state.
  async function send(overrideText) {
    // Only honour a real string. Wiring this straight to onClick hands us a
    // MouseEvent, which used to throw on .trim() and silently break the button.
    const text = (typeof overrideText === "string" ? overrideText : draft).trim();
    if (
      (!text && !attachments.length) ||
      sending ||
      convo.limitReached ||
      convo.initializing ||
      demoCap
    )
      return;
    setError(null);
    setSkillQuery(null);

    const userMsg = {
      role: "user",
      content: text,
      ...(attachments.length ? { attachments } : {}),
    };
    const historyForApi = [...convo.messages, userMsg];

    setDraft("");
    setAttachments([]);
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
          agentId: activeId,
          messages: historyForApi,
          token: convo.token,
          conversationId: convo.conversationId,
        }),
      });
      const data = await res.json();
      // Gate cookie expired or was cleared mid-session — send them back to the
      // password screen rather than showing a bare error.
      if (res.status === 401 && data.locked) {
        setGate({ checked: true, locked: true });
        return;
      }
      // Shared daily allowance spent — becomes a "get in touch" prompt rather
      // than an error, and the user's message stays in the transcript.
      if (data.demoCapReached) {
        setDemoCap({ personalCap: Boolean(data.personalCap) });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Request failed");

      setConvos((prev) => {
        const prevConvo = prev[activeId];
        const nextMessages =
          data.limitReached && !data.reply
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

  // Not a hook, despite the old name — the `use` prefix is reserved for hooks and
  // made rules-of-hooks flag every call site as a violation.
  function applyStarter(starter) {
    if (starter.action === "overview") {
      // Interface action, not a message. The conversation stays exactly where it
      // is — the sidebar card comes back to it.
      setLanding(true);
      setShowSkills(false);
      setShowSources(false);
      return;
    }
    if (starter.action === "sources") {
      // An interface action, not a message — costs no turns and no tokens.
      setShowSources(true);
      setShowSkills(false);
      setLanding(false);
      return;
    }
    if (starter.fill) {
      // Needs the user to add something (a transcript, a challenge) — hand them
      // the composer rather than sending an incomplete request.
      setDraft(starter.prompt);
      inputRef.current?.focus();
      return;
    }
    send(starter.prompt);
  }

  function resetConversation() {
    initStarted.current.delete(activeId);
    setConvos((prev) => ({ ...prev, [activeId]: emptyConvo(active.maxTurns) }));
    setAttachments([]);
    setError(null);
  }

  function switchAgent(id) {
    setActiveId(id);
    setShowSources(false);
    setShowSkills(false);
    setLanding(false);
    setSkillQuery(null);
    setAttachments([]);
    setError(null);
    // Only on a phone, where the drawer covers the conversation and you
    // couldn't otherwise see who you just picked. On desktop the sidebar is a
    // permanent column and should stay exactly where it is.
    if (isNarrow) setSidebarOpen(false);
  }

  function insertSkill(command) {
    // Replace the partial "/xyz" token being typed with the full command.
    setDraft((prev) => prev.replace(/\/[\w-]*$/, command + " "));
    setSkillQuery(null);
    inputRef.current?.focus();
  }

  function onDraftChange(e) {
    const value = e.target.value;
    setDraft(value);
    // Open the quick-insert popup while typing a "/command" token at the end.
    const match = value.match(/(?:^|\s)\/([\w-]*)$/);
    if (match) {
      setSkillQuery(match[1]);
      setSkillIndex(0);
    } else {
      setSkillQuery(null);
    }
  }

  function handleKeyDown(e) {
    if (skillQuery !== null && skillMatches.length) {
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        insertSkill(skillMatches[skillIndex].command);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSkillIndex((i) => (i + 1) % skillMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSkillIndex((i) => (i - 1 + skillMatches.length) % skillMatches.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSkillQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const inputDisabled = sending || convo.initializing;

  // Starters are for the top of a conversation only — they disappear as soon as
  // the user has actually said something.
  const hasUserMessage = convo.messages.some((m) => m.role === "user" && !m.hidden);
  const showStarters =
    gate.checked &&
    !gate.locked &&
    !demoCap &&
    !convo.limitReached &&
    convo.initialized &&
    !convo.initializing &&
    !hasUserMessage &&
    !sending;

  if (!gate.checked) {
    return (
      <div
        style={{
          ...THEME,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--purple-deep)",
          color: "rgba(255,255,255,.7)",
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: ".9rem",
        }}
      >
        Loading…
      </div>
    );
  }

  if (gate.locked) {
    return (
      <PasswordGate
        onUnlock={() => {
          setGate({ checked: true, locked: false });
          // Clear any half-started priming so each agent re-initialises cleanly
          // now that requests will actually be authorised.
          initStarted.current.clear();
          setConvos(initialConvos());
        }}
      />
    );
  }

  // After the password, before the app: consent has to precede the priming turn,
  // which is the first thing to send content to Anthropic.
  if (!acknowledged) {
    return <AcknowledgementGate onAccept={() => setAcknowledged(true)} />;
  }

  return (
    <div
      style={{
        ...THEME,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "var(--bg)",
      }}
    >
      {/* Sticky chrome bar — mirrors the evidence-map site's pattern */}
      <div
        style={{
          background: "var(--slate)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: ".4rem",
          padding: ".4rem .7rem",
          boxShadow: "0 3px 10px rgba(0,0,0,.18)",
          flexShrink: 0,
          zIndex: 20,
          flexWrap: "wrap",
        }}
      >
        <a
          href={EVIDENCE_MAP_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#cdd7e0",
            textDecoration: "none",
            fontSize: isNarrow ? ".74rem" : ".82rem",
            fontWeight: 600,
            flex: isNarrow ? "0 1 auto" : 1,
            display: "flex",
            alignItems: "center",
            gap: ".4rem",
            whiteSpace: "nowrap",
          }}
        >
          <span>←</span>
          {/* Same label the site's own sticky bar uses, at every width — the
              viewer's toolbar prefixes its own "Back to", and the long version
              wrapped on a phone. */}
          <span>Evidence Map</span>
        </a>
        {isNarrow && <span style={{ flex: 1 }} />}
        {/* Both of these are scoped to whoever you're talking to, so they'd be
            meaningless on the overview — there is no active agent yet. */}
        {!landing && (
        <button
          onClick={() => {
            setShowSkills((v) => !v);
            setShowSources(false);
            setLanding(false);
          }}
          style={barButtonStyle}
        >
          Available skills <span style={{ opacity: 0.7 }}>{skills.length}</span>{" "}
          {showSkills ? "▲" : "▼"}
        </button>
        )}
        {!landing && active.sources.length > 0 && (
          <button
            onClick={() => {
              setShowSources((v) => !v);
              setShowSkills(false);
              setLanding(false);
            }}
            style={barButtonStyle}
          >
            Sources &amp; evidence {showSources ? "▲" : "▼"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        {/* Backdrop — only exists while the drawer is open on a narrow screen */}
        {isNarrow && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.45)",
              zIndex: 90,
            }}
          />
        )}

        {/* Sidebar — a fixed drawer on narrow screens, a static column otherwise */}
        <aside
          className="uc-scroll"
          style={{
            width: isNarrow ? "80vw" : 280,
            maxWidth: 320,
            flexShrink: 0,
            background: "var(--slate)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            ...(isNarrow
              ? {
                  position: "fixed",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  zIndex: 100,
                  transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                  transition: "transform .22s ease",
                  boxShadow: sidebarOpen ? "4px 0 24px rgba(0,0,0,.4)" : "none",
                }
              : {}),
          }}
        >
          {isNarrow && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                alignSelf: "flex-end",
                margin: ".6rem .7rem 0",
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.25)",
                color: "#fff",
                borderRadius: 8,
                padding: ".3rem .7rem",
                fontSize: ".75rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✕ Close
            </button>
          )}
          <div
            style={{
              padding: "1.25rem 1.25rem 1rem",
              borderBottom: "1px solid rgba(255,255,255,.12)",
            }}
          >
            <img
              src="/uc-logo.svg"
              alt="Urbina Consulting"
              style={{ height: 22, width: "auto", marginBottom: ".5rem" }}
            />
            <h1 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
              ucLoops Persona Simulator
            </h1>
            <p
              style={{
                fontSize: ".76rem",
                color: "rgba(255,255,255,.65)",
                margin: ".35rem 0 0",
              }}
            >
              BorderBlend engagement · synthetic case
            </p>
          </div>

          {/* Primary entry point to the workflow explainer. Sits above the agent
              list because understanding the loops is what makes the agent list
              make sense — as a top-bar button it read as a minor utility. */}
          <div style={{ padding: ".85rem .75rem .25rem" }}>
            <button
              onClick={() => {
                setLanding(true);
                setShowSkills(false);
                setShowSources(false);
                if (isNarrow) setSidebarOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: ".7rem",
                textAlign: "left",
                padding: ".7rem .8rem",
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                background: landing
                  ? "linear-gradient(180deg,var(--gold-bright),var(--gold))"
                  : "rgba(255,255,255,.07)",
                border: landing
                  ? "1px solid var(--gold)"
                  : "1px dashed rgba(232,188,82,.55)",
                color: landing ? "var(--purple-deep)" : "#fff",
                transition: "background .15s, border-color .15s",
              }}
            >
              <span style={{ fontSize: "1.15rem", lineHeight: 1, flexShrink: 0 }}>🔄</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: ".86rem", fontWeight: 700 }}>
                  How ucLoops works
                </div>
                <div
                  style={{
                    fontSize: ".71rem",
                    color: landing ? "rgba(80,8,80,.75)" : "rgba(255,255,255,.6)",
                    lineHeight: 1.35,
                  }}
                >
                  The 8 loops, and who does what
                </div>
              </span>
              <span style={{ fontSize: ".7rem", opacity: 0.7, flexShrink: 0 }}>
                {landing ? "●" : "▶"}
              </span>
            </button>
            <div
              style={{
                fontSize: ".68rem",
                color: "rgba(255,255,255,.4)",
                textAlign: "center",
                padding: ".6rem 0 .1rem",
              }}
            >
              ↓ pick an agent to talk to
            </div>
          </div>

          {[
            { title: "Personas", items: PERSONA_META },
            { title: "Assistants", items: ASSISTANT_META },
          ].map((section) => (
            <div key={section.title} style={{ padding: ".75rem .75rem 0" }}>
              <div
                style={{
                  fontSize: ".66rem",
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--gold-bright)",
                  padding: "0 .35rem .45rem",
                }}
              >
                {section.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
                {section.items.map((a) => {
                  const isActive = a.id === activeId;
                  const c = convos[a.id];
                  return (
                    <button
                      key={a.id}
                      onClick={() => switchAgent(a.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".7rem",
                        padding: ".6rem .65rem",
                        borderRadius: 10,
                        border: isActive ? "1px solid var(--gold)" : "1px solid transparent",
                        background: isActive ? "var(--slate-2)" : "transparent",
                        color: "#fff",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background .15s, border-color .15s",
                      }}
                    >
                      <AgentAvatar agent={a} size={40} />
                      <span style={{ minWidth: 0 }}>
                        <div style={{ fontSize: ".88rem", fontWeight: 600 }}>{a.name}</div>
                        <div
                          style={{
                            fontSize: ".7rem",
                            color: "rgba(255,255,255,.62)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.role}
                        </div>
                        {c.turnsUsed > 0 && (
                          <div
                            style={{
                              fontSize: ".65rem",
                              color: "var(--gold-bright)",
                              marginTop: 2,
                            }}
                          >
                            {c.turnsUsed}/{c.turnsMax} messages
                          </div>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Courses card — the sidebar counterpart of the promo banner on the
              BorderBlend deliverables site. Same copy, same destination, same
              purple-and-gold treatment, restated for a ~250px column: the logo
              sits above the copy rather than beside it, since side-by-side would
              leave the text about twelve characters wide. */}
          <div style={{ padding: "1rem .75rem 0" }}>
            <div
              style={{
                background: "var(--purple-deep)",
                border: "1px solid rgba(255,255,255,.16)",
                borderRadius: 10,
                padding: ".8rem .75rem",
                display: "flex",
                flexDirection: "column",
                gap: ".55rem",
              }}
            >
              <img
                src="/uc-logo.svg"
                alt="Urbina Consulting"
                style={{ height: 22, width: "auto", alignSelf: "flex-start" }}
              />
              <div style={{ fontSize: ".76rem", lineHeight: 1.4, color: "rgba(255,255,255,.9)" }}>
                This is a generated example built with Urbina&rsquo;s ucLoops AI
                methodology. It&rsquo;s even better used with{" "}
                <strong style={{ color: "var(--gold-bright)" }}>real research sources.</strong>{" "}
                Learn how to use it yourself on our cohort or private courses.
              </div>
              <a
                href={COURSES_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  alignSelf: "flex-start",
                  background: "linear-gradient(180deg, var(--gold-bright), var(--gold))",
                  color: "var(--slate)",
                  padding: ".38rem 1rem",
                  borderRadius: 999,
                  fontSize: ".78rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Learn more
              </a>
            </div>
          </div>

          <div style={{ height: ".75rem" }} />
        </aside>

        {/* Main column */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Drawer handle. Shows who you're talking to as well as opening the
              list, so the bar carries information rather than just being a
              control taking up a row on a small screen. */}
          {isNarrow && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: ".6rem",
                width: "100%",
                background: "var(--slate-2)",
                border: "none",
                borderBottom: "1px solid rgba(255,255,255,.12)",
                color: "#fff",
                padding: ".5rem .8rem",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: "1rem", lineHeight: 1 }}>☰</span>
              {/* On the overview there is no active agent, so showing an avatar
                  and "Now: Omar" would claim a conversation that isn't open. */}
              {landing ? (
                <span style={{ fontSize: "1rem", lineHeight: 1 }}>🔄</span>
              ) : (
                <AgentAvatar agent={active} size={24} ring={false} />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: ".78rem", fontWeight: 700 }}>
                  Open to chat with agents
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: ".68rem",
                    color: "rgba(255,255,255,.6)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {landing ? "Reading the overview" : `Now: ${active.name}`}
                </span>
              </span>
              <span style={{ fontSize: ".7rem", opacity: 0.6 }}>▶</span>
            </button>
          )}
          <header
            style={{
              background: "var(--purple-deep)",
              color: "#fff",
              padding: isNarrow ? ".7rem .9rem" : "1rem 1.5rem",
              display: "flex",
              alignItems: isNarrow ? "flex-start" : "center",
              justifyContent: "space-between",
              gap: isNarrow ? ".6rem" : "1rem",
              boxShadow: "0 2px 8px rgba(0,0,0,.15)",
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                data-testid="active-agent"
                style={{ fontSize: isNarrow ? "1rem" : "1.1rem", fontWeight: 700 }}
              >
                {active.name}
              </div>
              <div
                style={{
                  fontSize: isNarrow ? ".72rem" : ".8rem",
                  color: "rgba(255,255,255,.75)",
                  // On a phone this was wrapping to one word per line, because
                  // the sidebar left almost no width for it.
                  ...(isNarrow
                    ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                    : {}),
                }}
              >
                {active.role} · {active.detail}
              </div>
              {/* Always-present links to this persona's artefacts. The system
                  prompt also asks agents to link these when they mention them,
                  but that's probabilistic — a navigational affordance shouldn't
                  depend on the model remembering. */}
              {(active.profileUrl || active.journeyUrl) && (
                <div
                  style={{
                    display: "flex",
                    gap: ".7rem",
                    marginTop: ".4rem",
                    fontSize: ".73rem",
                    flexWrap: "wrap",
                  }}
                >
                  {active.profileUrl && (
                    <a
                      href={active.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gold-bright)", textDecoration: "none", fontWeight: 600 }}
                    >
                      🏷️ Persona profile ↗
                    </a>
                  )}
                  {active.journeyUrl ? (
                    <a
                      href={active.journeyUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--gold-bright)", textDecoration: "none", fontWeight: 600 }}
                    >
                      🗺️ {active.journeyLabel} ↗
                    </a>
                  ) : (
                    active.type === "persona" && (
                      <span style={{ color: "rgba(255,255,255,.5)" }}>
                        No journey mapped yet
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
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
                flexShrink: 0,
              }}
            >
              New conversation
            </button>
          </header>

          {/* The overview, as the full page rather than a panel dropping from the
              top. It's the first thing you see, so it gets the whole column —
              squeezing it into a 75vh drawer over a chat you hadn't started made
              it read as a reference popup instead of the starting point. */}
          {landing && (
            <div
              className="uc-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                background: "var(--bg)",
                padding: isNarrow ? "1.25rem 1rem 2rem" : "1.75rem 1.5rem 2.5rem",
              }}
            >
              <WorkflowDiagram
                onPickSkill={(command) => {
                  // Picking a skill is a decision to start working, so it leaves
                  // the overview and drops the command into the composer.
                  setDraft((d) => (d ? d + " " : "") + command + " ");
                  setLanding(false);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              />
              <div
                style={{
                  maxWidth: 880,
                  margin: "1.5rem auto 0",
                  padding: "1rem 1.1rem",
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: ".88rem",
                    fontWeight: 700,
                    color: "var(--slate)",
                    marginBottom: ".2rem",
                  }}
                >
                  Ready to try it?
                </div>
                <div
                  style={{
                    fontSize: ".8rem",
                    color: "var(--text-muted)",
                    marginBottom: ".85rem",
                  }}
                >
                  {isNarrow
                    ? "Open the agent list and pick someone to talk to."
                    : "Pick an agent from the list on the left, or start with a persona interview."}
                </div>
                <button
                  onClick={() => {
                    if (isNarrow) setSidebarOpen(true);
                    else switchAgent(PERSONA_META[0].id);
                  }}
                  style={{
                    background: "linear-gradient(180deg,var(--gold-bright),var(--gold))",
                    border: "1px solid var(--gold)",
                    borderRadius: 999,
                    color: "var(--purple-deep)",
                    padding: ".5rem 1.1rem",
                    fontSize: ".82rem",
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  {isNarrow
                    ? "☰ Choose an agent"
                    : `Start with ${PERSONA_META[0].name} →`}
                </button>
              </div>
            </div>
          )}

          {!landing && (
            <>
          {/* Available skills panel */}
          {showSkills && (
            <ScrollPanel
              maxHeight="60vh"
              fadeColor="#ffffff"
              padding="1rem 1.5rem"
              style={{
                background: "#fff",
                borderBottom: "2px solid var(--amber)",
                flexShrink: 0,
              }}
            >
              <div style={{ maxWidth: 820, margin: "0 auto" }}>
                {active.type === "persona" && (
                  <div
                    style={{
                      background: "#f7f5fb",
                      border: "1px solid #e2dced",
                      borderRadius: 10,
                      padding: ".7rem .9rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: ".68rem",
                        fontWeight: 700,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: "var(--purple)",
                        marginBottom: ".5rem",
                      }}
                    >
                      → {WORKFLOW_CHAIN.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: ".4rem",
                        flexWrap: "wrap",
                        marginBottom: ".5rem",
                      }}
                    >
                      {WORKFLOW_CHAIN.steps.map((step, i) => (
                        <span
                          key={step.command}
                          style={{ display: "inline-flex", alignItems: "center", gap: ".4rem" }}
                        >
                          <span
                            style={{
                              background: "#fff",
                              border: "1px solid #d5cfe4",
                              borderRadius: 6,
                              padding: ".25rem .5rem",
                              opacity: step.disabled ? 0.5 : 1,
                            }}
                          >
                            <code
                              style={{
                                fontSize: ".74rem",
                                fontWeight: 700,
                                color: "var(--purple)",
                              }}
                            >
                              {step.command}
                            </code>
                            <div style={{ fontSize: ".62rem", color: "var(--text-muted)" }}>
                              {step.agent}
                            </div>
                          </span>
                          {i < WORKFLOW_CHAIN.steps.length - 1 && (
                            <span style={{ color: "var(--text-muted)" }}>→</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: ".74rem", color: "var(--text-muted)" }}>
                      {WORKFLOW_CHAIN.note}
                    </div>
                  </div>
                )}

                {skillGroups.map((group) => (
                  <div key={group.name} style={{ marginBottom: "1rem" }}>
                    <div
                      style={{
                        fontSize: ".66rem",
                        fontWeight: 700,
                        letterSpacing: ".12em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        marginBottom: ".45rem",
                      }}
                    >
                      {group.name}
                    </div>
                    {group.skills.map((s) => (
                      <div
                        key={s.command + s.group}
                        style={{
                          display: "flex",
                          gap: ".9rem",
                          padding: ".45rem 0",
                          borderTop: "1px solid #f1f1f1",
                          opacity: s.disabled ? 0.62 : 1,
                        }}
                      >
                        <button
                          onClick={() => {
                            if (s.disabled) return;
                            setDraft((d) => (d ? d + " " : "") + s.command + " ");
                            setShowSkills(false);
                            inputRef.current?.focus();
                          }}
                          disabled={s.disabled}
                          title={s.disabled ? "Not available in the free demo" : "Insert into message"}
                          style={{
                            fontFamily: "ui-monospace, 'SF Mono', monospace",
                            fontSize: ".76rem",
                            fontWeight: 700,
                            color: s.disabled ? "var(--text-muted)" : "var(--purple)",
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: s.disabled ? "not-allowed" : "pointer",
                            width: 132,
                            flexShrink: 0,
                            textAlign: "left",
                          }}
                        >
                          {s.command}
                        </button>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: ".84rem", color: "var(--text)" }}>
                            {s.description}
                            {s.disabled && (
                              <span
                                style={{
                                  marginLeft: ".45rem",
                                  fontSize: ".62rem",
                                  fontWeight: 700,
                                  letterSpacing: ".04em",
                                  textTransform: "uppercase",
                                  background: "#fef3c7",
                                  color: "#92400e",
                                  border: "1px solid #fde68a",
                                  borderRadius: 4,
                                  padding: ".08rem .35rem",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Not in demo
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: ".72rem",
                              color: "var(--text-muted)",
                              fontStyle: "italic",
                            }}
                          >
                            e.g. {s.example}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ fontSize: ".74rem", color: "var(--text-muted)" }}>
                  Skills marked <strong>Not in demo</strong> can still be explained — ask about one and
                  the agent will describe what it does and when you'd use it, without running it.
                </div>
              </div>
            </ScrollPanel>
          )}

          {/* Sources panel */}
          {showSources && active.sources.length > 0 && (
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
              <div style={{ maxWidth: 820, margin: "0 auto" }}>
                <p style={{ margin: "0 0 .6rem", fontWeight: 600 }}>
                  {active.name} is grounded in {active.sources.length} interview
                  {active.sources.length === 1 ? "" : "s"} (~{wordTotal.toLocaleString()} words of
                  verbatim research), plus the full BorderBlend{" "}
                  {active.journeyLabel ? "persona profile and journey map" : "persona profile"}.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                  <a href={active.profileUrl} target="_blank" rel="noreferrer" style={chipStyle}>
                    🏷️ Full persona profile
                  </a>
                  {active.journeyUrl && (
                    <a href={active.journeyUrl} target="_blank" rel="noreferrer" style={chipStyle}>
                      🗺️ {active.journeyLabel}
                    </a>
                  )}
                  {active.sources.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noreferrer" style={chipStyle}>
                      🎙️ {s.label} · {s.words.toLocaleString()}w
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Transcript. The wrapper exists to give the "more below" affordance a
              positioned ancestor that does NOT scroll — anchoring it to the scroll
              container would put the pill at the bottom of the *content* rather
              than the bottom of the visible area. */}
          <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex" }}>
            <div
              ref={scrollRef}
              onScroll={handleTranscriptScroll}
              data-testid="transcript"
              style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}
            >
              {convo.initializing && (
                <div
                  style={{
                    maxWidth: 520,
                    margin: "2rem auto",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: ".92rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <AgentAvatar agent={active} size={72} ring={false} />
                  </div>
                  Getting {active.name} ready…
                </div>
              )}

              <div
                style={{
                  maxWidth: 720,
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {convo.messages
                  .filter((m) => !m.hidden)
                  .map((m, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                        gap: ".6rem",
                      }}
                    >
                      {m.role === "assistant" && (
                        <AgentAvatar agent={active} size={30} ring={false} />
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
                        {!!m.attachments?.length && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: ".35rem",
                              marginBottom: m.content ? ".5rem" : 0,
                            }}
                          >
                            {m.attachments.map((a) => (
                              <span
                                key={a.fileId}
                                style={{
                                  fontSize: ".72rem",
                                  background: "rgba(255,255,255,.16)",
                                  borderRadius: 6,
                                  padding: ".2rem .45rem",
                                }}
                              >
                                📎 {a.filename}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.content && (
                          <div className="md-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                {sending && (
                  <div style={{ display: "flex", gap: ".6rem" }}>
                    <AgentAvatar agent={active} size={30} ring={false} />
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

                {showStarters && (
                  <div style={{ marginTop: ".25rem", paddingLeft: "2.1rem" }}>
                    <div
                      style={{
                        fontSize: ".66rem",
                        fontWeight: 700,
                        letterSpacing: ".12em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                        marginBottom: ".55rem",
                      }}
                    >
                      Try one of these
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                      {startersForAgent(activeId, convo.starterSeed).map((s) => (
                        <button
                          key={s.label}
                          onClick={() => applyStarter(s)}
                          style={{
                            textAlign: "left",
                            // Action cards are tinted to match the panel they
                            // open, so it's not a surprise when clicking one
                            // reveals a panel instead of sending a message.
                            background: s.action ? "#fdf8ee" : "var(--bg-card)",
                            border: s.action ? "1px solid #f0d999" : "1px solid var(--border)",
                            borderLeft: s.action
                              ? "3px solid var(--amber)"
                              : "3px solid var(--gold)",
                            borderRadius: 10,
                            padding: ".55rem .8rem",
                            cursor: "pointer",
                            maxWidth: 330,
                            boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                            fontFamily: "inherit",
                          }}
                        >
                          <div
                            style={{
                              fontSize: ".84rem",
                              fontWeight: 600,
                              color: s.action ? "#7a5c0a" : "var(--slate)",
                              marginBottom: ".12rem",
                            }}
                          >
                            {s.action === "sources" && "🎙️ "}
                            {s.label}
                            {s.fill && (
                              <span
                                style={{
                                  marginLeft: ".35rem",
                                  fontWeight: 500,
                                  fontSize: ".7rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                →
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: ".74rem", color: "var(--text-muted)" }}>
                            {s.hint}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {transcript.overflowing && !transcript.atBottom && (
              <>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 56,
                    pointerEvents: "none",
                    background: "linear-gradient(to bottom, transparent, var(--bg))",
                  }}
                />
                <button
                  type="button"
                  onClick={scrollTranscriptToBottom}
                  data-testid="scroll-for-more"
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--slate)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    padding: ".26rem .7rem",
                    fontSize: ".68rem",
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    opacity: 0.9,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  scroll down for more ↓
                </button>
              </>
            )}
          </div>

          {/* Composer */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--bg-card)",
              padding: "1rem 1.5rem",
              flexShrink: 0,
            }}
          >
            <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
              {error && (
                <div style={{ color: "#b91c1c", fontSize: ".82rem", marginBottom: ".5rem" }}>
                  {error}
                </div>
              )}

              {/* Quick-insert skills popup */}
              {skillQuery !== null && skillMatches.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: 0,
                    right: 0,
                    marginBottom: ".5rem",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    boxShadow: "0 -4px 20px rgba(0,0,0,.12)",
                    overflow: "hidden",
                    zIndex: 30,
                  }}
                >
                  <div
                    style={{
                      fontSize: ".62rem",
                      fontWeight: 700,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      padding: ".45rem .75rem",
                      background: "#fafafa",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    Quick skills · Tab to insert
                  </div>
                  {skillMatches.map((s, i) => (
                    <button
                      key={s.command + s.group}
                      onMouseEnter={() => setSkillIndex(i)}
                      onClick={() => !s.disabled && insertSkill(s.command)}
                      disabled={s.disabled}
                      style={{
                        display: "flex",
                        width: "100%",
                        gap: ".75rem",
                        alignItems: "baseline",
                        padding: ".45rem .75rem",
                        background: i === skillIndex ? "#f7f5fb" : "transparent",
                        border: "none",
                        borderLeft:
                          i === skillIndex ? "3px solid var(--purple)" : "3px solid transparent",
                        cursor: s.disabled ? "not-allowed" : "pointer",
                        textAlign: "left",
                        opacity: s.disabled ? 0.55 : 1,
                      }}
                    >
                      <code
                        style={{
                          fontFamily: "ui-monospace, 'SF Mono', monospace",
                          fontSize: ".76rem",
                          fontWeight: 700,
                          color: "var(--purple)",
                          width: 124,
                          flexShrink: 0,
                        }}
                      >
                        {s.command}
                      </code>
                      <span
                        style={{
                          fontSize: ".78rem",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.description}
                        {s.disabled && " · not in demo"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {demoCap ? (
                <div
                  style={{
                    background: "linear-gradient(135deg,#f7f2fa,#fdf8ee)",
                    border: "1px solid #e2d4e8",
                    borderLeft: "5px solid var(--purple)",
                    borderRadius: 12,
                    padding: "1.1rem 1.25rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: ".68rem",
                      fontWeight: 700,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: "var(--purple)",
                      marginBottom: ".4rem",
                    }}
                  >
                    Due to popular demand
                  </div>
                  <p
                    style={{
                      margin: "0 0 .5rem",
                      fontSize: ".95rem",
                      fontWeight: 600,
                      color: "var(--slate)",
                    }}
                  >
                    {demoCap.personalCap
                      ? "You've explored a good chunk of this demo — thanks for giving it a proper go."
                      : "This free demo has reached today's shared limit."}
                  </p>
                  <p
                    style={{
                      margin: "0 0 .9rem",
                      fontSize: ".87rem",
                      color: "var(--text-muted)",
                      lineHeight: 1.55,
                    }}
                  >
                    The demo runs on a capped allowance so it stays free for everyone. Want
                    unlimited access, your own personas built from your real research, and the
                    skills that are switched off here? That's what the full version does — get in
                    touch and we'll set you up.
                    {!demoCap.personalCap && " Or come back tomorrow when the allowance resets."}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                    <ContactEmail
                      subject="Unlocked ucLoops demo access"
                      style={{
                        background: "linear-gradient(180deg,var(--gold-bright),var(--gold))",
                        color: "var(--purple-deep)",
                        borderRadius: 999,
                        padding: ".5rem 1.2rem",
                        fontWeight: 700,
                        fontSize: ".85rem",
                        textDecoration: "none",
                        cursor: "pointer",
                      }}
                    >
                      Request full access
                    </ContactEmail>
                    <a
                      href="https://urbinaconsulting.com/ucloops"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: "#fff",
                        border: "1px solid #d9c9e2",
                        color: "var(--purple)",
                        borderRadius: 999,
                        padding: ".5rem 1.2rem",
                        fontWeight: 700,
                        fontSize: ".85rem",
                        textDecoration: "none",
                      }}
                    >
                      About ucLoops training
                    </a>
                  </div>
                </div>
              ) : convo.limitReached ? (
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
                  <span>
                    You've reached the {convo.turnsMax}-message limit for this conversation.
                  </span>
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
                <>
                  {!!attachments.length && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: ".4rem",
                        marginBottom: ".5rem",
                      }}
                    >
                      {attachments.map((a) => (
                        <span
                          key={a.fileId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: ".4rem",
                            background: "#f1f5f9",
                            border: "1px solid #dbe2ea",
                            borderRadius: 999,
                            padding: ".25rem .35rem .25rem .7rem",
                            fontSize: ".76rem",
                            color: "var(--slate)",
                          }}
                        >
                          📎 {a.filename}
                          <span style={{ color: "var(--text-muted)" }}>
                            {(a.sizeBytes / 1024).toFixed(0)}KB
                          </span>
                          <button
                            onClick={() =>
                              setAttachments((prev) => prev.filter((x) => x.fileId !== a.fileId))
                            }
                            aria-label={`Remove ${a.filename}`}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-muted)",
                              fontSize: ".9rem",
                              lineHeight: 1,
                              padding: "0 .2rem",
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: ".6rem", alignItems: "flex-end" }}>
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.gif,.webp"
                      onChange={(e) => handleFiles(e.target.files)}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading || attachments.length >= MAX_FILES || inputDisabled}
                      title={
                        attachments.length >= MAX_FILES
                          ? `Up to ${MAX_FILES} files per message`
                          : "Attach research (PDF, text, CSV, or image — 1MB each)"
                      }
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: ".7rem .8rem",
                        fontSize: "1rem",
                        cursor:
                          uploading || attachments.length >= MAX_FILES || inputDisabled
                            ? "default"
                            : "pointer",
                        opacity:
                          uploading || attachments.length >= MAX_FILES || inputDisabled ? 0.5 : 1,
                        flexShrink: 0,
                        lineHeight: 1,
                      }}
                    >
                      {uploading ? "⏳" : "📎"}
                    </button>
                    <textarea
                      ref={inputRef}
                      value={draft}
                      onChange={onDraftChange}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        convo.initializing
                          ? `${active.name} is getting ready…`
                          : `Message ${active.name}…  (/ for skills, Shift+Enter for a new line)`
                      }
                      rows={1}
                      disabled={inputDisabled}
                      style={{
                        flex: 1,
                        resize: "none",
                        padding: ".7rem .9rem",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        fontFamily: "inherit",
                        fontSize: ".92rem",
                        outline: "none",
                        maxHeight: 140,
                      }}
                    />
                    <button
                      // Not `onClick={send}`: React would pass the click event as
                      // `overrideText`, and send() calls .trim() on it.
                      onClick={() => send()}
                      disabled={inputDisabled || (!draft.trim() && !attachments.length)}
                      style={{
                        background: "linear-gradient(180deg,var(--gold-bright),var(--gold))",
                        color: "var(--purple-deep)",
                        border: "none",
                        borderRadius: 10,
                        padding: ".7rem 1.4rem",
                        fontWeight: 700,
                        fontSize: ".9rem",
                        cursor:
                          inputDisabled || (!draft.trim() && !attachments.length)
                            ? "default"
                            : "pointer",
                        opacity:
                          inputDisabled || (!draft.trim() && !attachments.length) ? 0.55 : 1,
                        flexShrink: 0,
                      }}
                    >
                      Send
                    </button>
                  </div>
                </>
              )}

              <div
                style={{
                  fontSize: ".7rem",
                  color: "var(--text-muted)",
                  marginTop: ".5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                {/* Order matters: each label sits under the control it
                    describes — attachment note under the paperclip on the
                    left, message counter under Send on the right. */}
                <span>Attach up to {MAX_FILES} files, 1MB each</span>
                <span style={{ textAlign: "right" }}>
                  {convo.turnsUsed}/{convo.turnsMax} messages used in this conversation
                </span>
              </div>
            </div>
          </div>
            </>
          )}
        </main>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        textarea::placeholder { color: #9ca3af; }
        /* Force a visible scrollbar in the panels. Overlay scrollbars hide
           until you scroll, which is precisely when the hint is needed. */
        .uc-scroll { scrollbar-width: thin; scrollbar-color: #c9c3cf transparent; }
        .uc-scroll::-webkit-scrollbar { width: 10px; }
        .uc-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,.04); }
        .uc-scroll::-webkit-scrollbar-thumb {
          background: #c9c3cf; border-radius: 999px; border: 2px solid transparent;
          background-clip: content-box;
        }
        .uc-scroll::-webkit-scrollbar-thumb:hover { background: #a99fb3; background-clip: content-box; }
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
        .md-content table { border-collapse: collapse; margin: 0 0 .6rem; font-size: .85em; display: block; overflow-x: auto; }
        .md-content th, .md-content td { border: 1px solid rgba(0,0,0,.12); padding: .3rem .5rem; text-align: left; }
        .md-content th { background: rgba(0,0,0,.04); font-weight: 700; }
        .bubble-user .md-content a { color: var(--gold-bright); }
        .bubble-user .md-content code { background: rgba(255,255,255,.18); }
        .bubble-user .md-content hr { border-top-color: rgba(255,255,255,.25); }
      `}</style>
    </div>
  );
}
