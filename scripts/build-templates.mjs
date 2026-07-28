// Compiles the ucLoops markdown templates in src/ucLoops-templates/ into a
// generated JS module that both the client and the serverless function can
// import.
//
// Why generate instead of reading the .md at runtime: api/chat.js runs as a
// Vercel serverless function, where reading sibling files off disk is fragile
// (bundling may not include them). Vite's `?raw` import doesn't help either,
// since the API function isn't processed by Vite. Compiling to a plain .js
// module sidesteps both problems while keeping the .md files the source of
// truth — edit a template, re-run this script.
//
// Usage: node scripts/build-templates.mjs
// Runs automatically on `npm run build` via the prebuild hook.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const templateDir = join(here, "..", "src", "ucLoops-templates");
const outFile = join(here, "..", "src", "templates.generated.js");

// Maps a source .md filename to the JS constant it becomes.
const EXPORTS = {
  "ucLoops Persona Master Template v4.md": "PERSONA_MASTER_TEMPLATE",
  "ucLoops UX Assistant Master Template v3.md": "UX_ASSISTANT_TEMPLATE",
  "ucLoops DATA Assistant Master Template v3-demo.md": "DATA_ASSISTANT_TEMPLATE",
  "ucLoops Shared Skills.md": "SHARED_SKILLS",
  "uc-meeting-transcript.md": "TRANSCRIPT_CLEANUP_SKILL",
};

// Escape so the content is safe inside a JS template literal.
function escapeForTemplateLiteral(text) {
  return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

const present = new Set(readdirSync(templateDir).filter((f) => f.endsWith(".md")));
const missing = Object.keys(EXPORTS).filter((f) => !present.has(f));
if (missing.length) {
  console.error("Missing expected template file(s):");
  for (const f of missing) console.error(`  - ${f}`);
  process.exit(1);
}

const unmapped = [...present].filter((f) => !EXPORTS[f]);
if (unmapped.length) {
  console.warn("Note: .md files present but not mapped to an export (ignored):");
  for (const f of unmapped) console.warn(`  - ${f}`);
}

const parts = [
  "// AUTO-GENERATED — do not edit by hand.",
  "// Source: src/ucLoops-templates/*.md",
  "// Regenerate with: node scripts/build-templates.mjs",
  "",
];

const summary = [];
for (const [file, constName] of Object.entries(EXPORTS)) {
  const raw = readFileSync(join(templateDir, file), "utf8").trim();
  parts.push(`// ${file}`);
  parts.push(`export const ${constName} = \`${escapeForTemplateLiteral(raw)}\`;`);
  parts.push("");
  summary.push({ constName, file, chars: raw.length });
}

writeFileSync(outFile, parts.join("\n"), "utf8");

console.log(`Wrote src/templates.generated.js`);
for (const s of summary) {
  console.log(`  ${s.constName.padEnd(26)} ${String(s.chars).padStart(6)} chars  (${s.file})`);
}
