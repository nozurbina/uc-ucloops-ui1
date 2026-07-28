# ucLoops Persona Simulator

Chat with the five BorderBlend research personas (Omar, Grace, Mateo, Diego, Tyler) — each one is Claude Haiku 4.5, grounded in the full verbatim interview transcripts behind that persona, roleplaying in first person per the ucLoops Persona Master Template.

## Architecture

- **Frontend**: Vite + React, static build.
- **Backend**: one Vercel serverless function (`api/chat.js`) that holds the Anthropic API key server-side and proxies chat requests. The browser never sees the key.
- **Rate limiting**: each conversation is capped at 15 messages. The limit is enforced with a signed, stateless token (HMAC over a turn counter + expiry) round-tripped between client and server on every reply — no database needed, and it survives serverless cold starts. Tampering with the token just resets the conversation to 0 turns (equivalent to the user opening a new tab, which they could always do anyway).
- **Cost cap**: `max_tokens` is hardcoded server-side (700) regardless of what the client sends.

## Local development

You need two things running together — the Vite dev server and Vercel's local function runtime:

```bash
npm install
npm install -g vercel   # once, if you don't have it
cp .env.local.example .env.local   # then fill in your real API key + a random secret
vercel dev
```

`vercel dev` serves both the static frontend and `/api/chat` on one port (usually `http://localhost:3000`), so just open that — you don't need `npm run dev` separately once `vercel dev` is running.

## Deploying to Vercel

1. Push this repo to GitHub (or run `vercel` from this folder to deploy directly without a git remote).
2. In the Vercel dashboard, import the project.
3. Under **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` — your real key
   - `CHAT_SESSION_SECRET` — any long random string (`openssl rand -hex 32`)
4. Deploy. Vercel auto-detects the Vite frontend and the `api/` folder as serverless functions — no extra config needed.

### Extra safety net (recommended, costs nothing to set up)

In the [Anthropic Console](https://console.anthropic.com/), set a hard spend limit on the API key used here. Even if there's ever a bug in the turn-limit logic, this caps worst-case cost at whatever you set.

## Project structure

```
api/chat.js          — the only backend code; holds the API key, enforces the message limit
src/personas.js      — full persona system prompts + complete interview transcripts (server-side only, large file)
src/personaMeta.js   — lightweight persona list for the UI (name, photo, role) — safe to ship to the browser
src/PersonaChat.jsx  — the chat UI
public/headshots/    — persona photos
public/uc-logo.svg   — Urbina Consulting logo
```

## Model & scope

Uses `claude-haiku-4-5` (cheap, fast — matches the low-stakes nature of a demo chat tool). To change models or the turn limit, edit the constants at the top of `api/chat.js`.
