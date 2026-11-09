import js from "@eslint/js";
import globals from "globals";

export default [
  {ignores: ["dist/", "playwright-report/", "test-results/"]},
  js.configs.recommended,
  {
    languageOptions: {globals: {...globals.browser, claude: "readonly"}},
    rules: {"no-empty": ["error", {allowEmptyCatch: true}], "no-unused-vars": ["error", {args: "none", caughtErrors: "none"}]},
  },
  {files: ["*.config.js", "scripts/**", "tests/**"], languageOptions: {globals: globals.node}},
];
