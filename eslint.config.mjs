import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Playwright's fixture callback named `use` is not a React hook.
  { files: ["tests/e2e/**/*.ts"], rules: { "react-hooks/rules-of-hooks": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "public/pdf.worker.min.mjs",
    "public/data/build-dictionary.mjs",
    "public/data/build-wiktionary.mjs",
    "private-data/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
