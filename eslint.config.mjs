import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import importPlugin from "eslint-plugin-import";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Catch duplicate import statements at lint time before they reach CI.
  {
    plugins: { import: importPlugin },
    rules: {
      "import/no-duplicates": "error",
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: ["./tsconfig.json"],
        },
      },
    },
  },
  // Enforce that process.env is only read through the typed loader in
  // lib/config/env.js.  Config files, test files, and a handful of modules
  // that legitimately read NODE_ENV are exempt.
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    ignores: [
      // Test files manipulate process.env for fixture setup.
      "**/*.test.*",
      "**/*.spec.*",
      "**/__tests__/**",
      "**/__snapshots__/**",
      // Canonical typed env loader.
      "lib/config/env.js",
      // Build / tooling config files that predate the app runtime.
      "**/*.config.{mjs,js,ts,cjs}",
      // Bootstrap files evaluated before the loader is available.
      "jest.setup.js",
      "jest.setup.cjs",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Use the typed env singleton from 'lib/config/env' instead of " +
            "accessing process.env directly. Import with: " +
            "import { env } from '../lib/config/env';",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
