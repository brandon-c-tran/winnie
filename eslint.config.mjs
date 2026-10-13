// Catch the mistakes that only show up at runtime otherwise: undefined names, unused
// imports, and assignments to things that do not exist.
import globals from "globals";

export default [
  {
    ignores: [
      "public/vendor/**",
      "playwright-report/**",
      "test-results/**",
      "node_modules/**",
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".local/**",
      ".impeccable/**",
    ],
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        {
          args: "none",
          caughtErrors: "none",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-const-assign": "error",
      "no-self-assign": "error",
    },
  },
  {
    files: ["public/**/*.js"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ["netlify/**", "scripts/**", "tests/**", "seed/**", "*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  // browser tests run code inside the page too
  {
    files: ["e2e/**"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
