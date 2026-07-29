# ucLoops Persona Simulator

A free-demo chat interface for the ucLoops methodology, running on Claude Haiku 4.5:

- **5 BorderBlend personas** (Omar, Grace, Mateo, Diego, Tyler) — each roleplays in first person, grounded in the full verbatim interview transcripts behind that persona, plus their journey-map stages where one exists.
- **UX Assistant** — journey outlines (single and multi-persona), user stories, ideation.
- **Data Assistant** — transcript cleanup, persona synthesis, dataset indexing.

## Architecture

- **Frontend**: Vite + React, static build.
- **Backend**: two Vercel serverless functions — `api/chat.js` and `api/upload.js`. The Anthropic API key stays server-side; the browser never sees it.
- **Templates as source of truth**: the agent behaviour specs live as markdown in `src/ucLoops-templates/`. `scripts/build-templates.mjs` compiles them into `src/templates.generated.js`, which both the agents and the serverless functions import. Edit a `.md`, re-run `npm run templates` (it also runs automatically on `npm run build`).

### Demo limits

| Limit | Value | Needs Upstash |
|---|---|---|
| Shared password gate | `DEMO_PASSWORD` — unset disables it | no |
| Messages per conversation | 15 (personas) / 25 (assistants) | no |
| Attachments per message | 3, 1MB each | no |
| Output tokens per reply | 1200, hardcoded server-side | no |
| **Global daily cap** | **300 model calls per UTC day (`DEMO_DAILY_CALL_CAP`)** | **yes** |
| Per-IP cap | 60 model calls per rolling 3-day window | yes |

**What a conversation actually costs.** Measured against the live system prompts on Haiku 4.5: a persona's system prompt is ~14,300 tokens (Diego, the largest, ~18,700); the assistants are ~3,600. An *exhausted* conversation works out at roughly **30–60 cents**. The default 300-call daily cap therefore bounds a day at about $6–9.

The global daily cap is the cost control that doesn't depend on a provider-side spend limit — useful because Anthropic's limits apply account-wide, not per key. When it trips, the UI shows a "due to popular demand" prompt inviting the visitor to get in touch for full access, rather than an error.

**Disabled skills.** Several methodology skills are marked `(DISABLED IN FREE DEMO)` in the templates — `/p-create-page`, `/j-create-page`, `/j-suggest`, `/j-data`, `/persona-export`, `/create-index`, `/clean-index`. The agents will still *describe* what these do and when you'd reach for them, but won't run them or produce their deliverables. They're listed in the Available Skills panel with a "Not in demo" badge.

### How the abuse limits work, and what they don't do

Three layers, because none alone is enough:

1. **Signed session token** — tracks turns within one conversation; tamper-proof (HMAC).
2. **httpOnly cookie** — carries that token so a plain page refresh doesn't reset the count. JS can't read or clear an httpOnly cookie. Zero infrastructure.
3. **Per-IP counter** in Upstash Redis over a rolling 3-day window — the only layer that survives incognito or cleared storage.

Layers 1 and 2 always work. Layer 3 activates only when the Upstash env vars are set, and **fails open** if the store is unreachable (a demo that breaks because Redis blipped is worse than one that briefly over-serves).

**Be clear-eyed about the ceiling:** none of this stops someone determined with a VPN. Short of real accounts, nothing does. The actual backstop is a **hard spend limit on the API key** in the [Anthropic Console](https://console.anthropic.com/) — set one; it costs nothing and caps worst-case exposure regardless of any bug in the logic above.

## Local development

```bash
npm install
npm install -g vercel                # once
cp .env.local.example .env.local     # then fill in the values
vercel dev
```

`vercel dev` serves the frontend and both API routes on one port (usually `http://localhost:3000`).

> **Note:** once the project is linked to Vercel, `vercel dev` reads environment variables from the **cloud project**, not `.env.local` (you'll see `Ignoring .env.local` in `--debug` output). Set them with `vercel env add <NAME> development` — or in the dashboard — or the functions will start with no API key.

## Deploying

1. Push to GitHub and import the project in Vercel (or run `vercel` from this folder).
2. Under **Settings → Environment Variables**, add `ANTHROPIC_API_KEY` and `CHAT_SESSION_SECRET` (and the two `UPSTASH_*` vars if you want the per-IP cap).
3. Deploy. Vercel auto-detects the Vite frontend and the `api/` folder — no extra config.

### Activating the spend caps (optional but recommended)

The global daily cap and the per-IP cap both need a shared counter, which is the only thing Upstash is used for:

1. Create a free Upstash Redis database (via the Vercel Marketplace integration or directly at upstash.com).
2. Add its **REST URL** and **REST token** as `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.
3. Optionally set `DEMO_DAILY_CALL_CAP` (default 300).
4. Redeploy.

Both caps **fail open**: if Upstash isn't configured, or is configured but unreachable, requests are allowed through and a warning is logged. A demo that breaks because Redis blipped is worse than one that briefly over-serves. Verified in both cases.

Tune `IP_TURN_CAP` / `IP_WINDOW_DAYS` at the top of `api/_limits.js`.

## Project structure

```
api/chat.js               — chat endpoint; holds the key, enforces turn limits, resolves attachments
api/upload.js             — uploads an attachment to the Anthropic Files API, returns a file_id
api/_limits.js            — signed tokens, httpOnly cookie, per-IP cap
scripts/build-templates.mjs — compiles src/ucLoops-templates/*.md → src/templates.generated.js
src/ucLoops-templates/    — the methodology templates (SOURCE OF TRUTH — edit these)
src/personas.js           — persona system prompts + full transcripts (server-side only, large)
src/assistants.js         — UX + Data assistant system prompts
src/agents.js             — combined registry + per-agent turn limits
src/skills.js             — client-safe skills catalogue with disabled flags
src/agentMeta.js          — client-safe agent metadata (names, photos, sources)
src/AgentChat.jsx         — the chat UI
```

`personas.js`, `assistants.js`, and `agents.js` are imported **only** by the serverless functions — the full system prompts and interview transcripts never reach the browser. (`npm run build` then grepping `dist/assets/*.js` for template markers is a quick way to confirm this after changes.)

## Changing the model or limits

Model and output cap: top of `api/chat.js`. Turn limits: `src/agents.js`. Attachment limits: `api/upload.js` (server-authoritative) and the matching constants in `src/AgentChat.jsx` (client-side pre-check).
