# Copy editing workflow (for Claude Code)

You'll be editing the words in this project — never the code. You don't need to
learn git. You just need to tell Claude Code what to do, in plain English, and
follow the same routine every session. Copy-paste the prompts below exactly;
the *italic* parts are where you describe what you actually want.

## The one rule

**All your work happens on a branch called `copy-edits` — never on `main`.**

Think of `copy-edits` as your personal draft copy of the project. Noz reviews
your draft and decides what gets pulled into the real version (`main`). As long
as you stay on your branch, nothing you do can break anything.

## One-time setup (first session only)

Tell Claude Code:

> Create a branch called copy-edits, switch to it, and push it to GitHub so it's
> saved there too.

If Claude says the branch already exists (e.g. you set it up on another
computer), instead say:

> Switch to the copy-edits branch and pull the latest version from GitHub.

## Every session: the four-step routine

### Step 1 — Catch up (always do this first)

> Make sure I'm on the copy-edits branch, pull my latest changes from GitHub,
> and then merge in the latest main branch so I have Noz's newest work.

This matters because Noz is changing the project at the same time. Doing this
at the start of every session keeps your copy fresh and avoids painful
untangling later.

### Step 2 — Make your edits

Describe the wording change you want. Always mention you only want text
changed. Real examples from this project:

> In the persona profiles, change every mention of *"management consultant"* to
> *"strategy consultant"*. Only change the wording — no code changes.

> Rewrite the conversation starter questions so they sound *less formal*. Show
> me the new wording before saving. Text only.

> In the ucLoops Persona Master Template markdown file, tighten the intro
> paragraph — it's too long. Don't touch anything except the words.

### Step 3 — Check what changed

Before saving anything, ask:

> Show me a plain-English summary of every file you changed and what changed
> in each.

Read it. If anything sounds like more than a wording change ("renamed a
function", "updated the logic", "changed a setting"), say:

> Undo that part — I only want the text changes.

### Step 4 — Save and send (end of every session, no exceptions)

> Commit all my changes with a message describing the copy edits, and push to
> GitHub. Double-check you're pushing to the copy-edits branch, not main.

If you skip this step, your work only exists on your computer and Noz can't
see it. Do it even if you're mid-way through something — an unfinished draft
on GitHub beats a finished one nobody can see.

## Where the words live (so your requests land in the right place)

You don't need to open these yourself — but naming them helps Claude go
straight to the right spot:

- **Persona profiles and interview material** — `src/personas.js`
- **The suggested opening questions in the chat** — `src/starters.js`
- **Agent names and short descriptions** — `src/agentMeta.js`
- **The master templates (the big instruction documents)** — the markdown
  files in `src/ucLoops-templates/`
- **The project description** — `README.md`

⚠️ Two files are **off-limits** even though they contain words:
`src/templates.generated.js` (it's rebuilt automatically from the markdown
templates — edit the markdown instead, and any edits here get wiped out) and
the interview transcripts inside `src/personas.js` (they're verbatim records
and must stay word-for-word). If Claude suggests editing either, say no and
ask it to make the change in the right source file instead.

## If something goes wrong

- **Claude mentions a "merge conflict"** — stop. Don't let it guess. Tell
  Claude: *"Stop — don't resolve anything"*, then message Noz. Conflicts just
  mean you and Noz touched the same lines; they take two minutes to sort out
  together and can lose work if handled blind.
- **Claude says you're on `main`** — say: *"Switch to the copy-edits branch
  and bring my changes with me."*
- **You're not sure whether your work got saved** — ask: *"Is everything
  committed and pushed to the copy-edits branch on GitHub?"* and make Claude
  confirm.
- **Anything else feels off** — don't experiment. Ask Claude to explain what
  happened in plain English, screenshot it, and send it to Noz.
