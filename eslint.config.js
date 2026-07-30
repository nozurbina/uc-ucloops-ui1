// ESLint flat config (ESLint 9). `npm run lint` had been failing outright since
// the v9 migration dropped .eslintrc support and no flat config existed.
//
// Three environments in one repo, each with different globals:
//   src/       browser, JSX, React hooks
//   api/       Node serverless functions
//   scripts/   Node build scripts
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "node_modules/**", ".vercel/**", "src/templates.generated.js"] },

  js.configs.recommended,

  // Client code.
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // The codebase uses caught-and-ignored errors deliberately (`catch {}` where
      // failing open is the intended behaviour), so an unused binding there isn't a
      // defect. Uppercase-prefixed names are module constants that may be
      // referenced only conditionally.
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
    },
  },

  // Serverless functions and build scripts.
  {
    files: ["api/**/*.js", "scripts/**/*.mjs", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
];
