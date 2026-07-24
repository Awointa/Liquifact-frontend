/**
 * @jest-environment node
 *
 * tests/lint/no-raw-env.test.tsx
 *
 * Programmatic ESLint tests for the no-restricted-syntax rule that bans raw
 * process.env access outside lib/config/env.js and config files.
 *
 * The rule uses the AST selector:
 *   MemberExpression[object.name='process'][property.name='env']
 *
 * This catches every form of process.env usage — direct property access,
 * computed access, destructuring, and chained member expressions like
 * process.env.NEXT_PUBLIC_API_URL.
 */

import { Linter } from "eslint";

const linter = new Linter({ configType: "flat" });

const RULE_CONFIG = {
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
};

function lint(code: string) {
  return linter.verify(code, RULE_CONFIG);
}

// ---------------------------------------------------------------
// Flags
// ---------------------------------------------------------------

describe("no-restricted-syntax: process.env", () => {
  describe("simple property access", () => {
    it("flags process.env.SOME_VAR", () => {
      const messages = lint("const x = process.env.SOME_VAR;");
      expect(messages).toHaveLength(1);
      expect(messages[0].ruleId).toBe("no-restricted-syntax");
    });

    it("flags process.env.NEXT_PUBLIC_API_URL", () => {
      const messages = lint("const url = process.env.NEXT_PUBLIC_API_URL;");
      expect(messages).toHaveLength(1);
      expect(messages[0].ruleId).toBe("no-restricted-syntax");
    });

    it("flags chained access: process.env.FOO.BAR", () => {
      const messages = lint("const x = process.env.FOO.BAR;");
      expect(messages).toHaveLength(1);
    });
  });

  describe("computed property access", () => {
    it("flags process.env['VAR']", () => {
      const messages = lint("const x = process.env['VAR'];");
      expect(messages).toHaveLength(1);
      expect(messages[0].ruleId).toBe("no-restricted-syntax");
    });

    it("flags process.env[variable]", () => {
      const messages = lint("const key = 'X'; const x = process.env[key];");
      expect(messages).toHaveLength(1);
    });

    it("flags process.env[`VAR`]", () => {
      const messages = lint("const x = process.env[`VAR`];");
      expect(messages).toHaveLength(1);
    });
  });

  describe("bare process.env reference (used in destructuring / assignment)", () => {
    it("flags bare process.env", () => {
      const messages = lint("const env = process.env;");
      expect(messages).toHaveLength(1);
    });

    it("flags destructuring from process.env", () => {
      const messages = lint("const { FOO } = process.env;");
      expect(messages).toHaveLength(1);
    });

    it("flags multiple destructuring from process.env", () => {
      const messages = lint("const { A, B, C } = process.env;");
      expect(messages).toHaveLength(1);
    });

    it("flags nested destructuring from process.env", () => {
      const messages = lint("const { X: { Y } } = process.env;");
      expect(messages).toHaveLength(1);
    });

    it("flags process.env passed as a function argument", () => {
      const messages = lint("doThing(process.env);");
      expect(messages).toHaveLength(1);
    });

    it("flags process.env in a conditional", () => {
      const messages = lint("if (process.env.NODE_ENV) {}");
      expect(messages).toHaveLength(1);
    });

    it("flags process.env with a logical OR fallback", () => {
      const messages = lint("const url = process.env.API_URL || 'http://localhost:3001';");
      expect(messages).toHaveLength(1);
    });

    it("flags process.env with nullish coalescing", () => {
      const messages = lint("const url = process.env.API_URL ?? 'default';");
      expect(messages).toHaveLength(1);
    });

    it("flags process.env in a ternary", () => {
      const messages = lint("const x = process.env.A ? 'yes' : 'no';");
      expect(messages).toHaveLength(1);
    });

    it("flags process.env inside a template literal", () => {
      const messages = lint("const url = `${process.env.BASE}/api`;");
      expect(messages).toHaveLength(1);
    });
  });

  describe("message content", () => {
    it("includes a descriptive error message", () => {
      const messages = lint("const x = process.env.FOO;");
      expect(messages[0].message).toMatch(/process\.env/);
      expect(messages[0].message).toMatch(/lib\/config\/env/);
    });

    it("reports the correct rule severity", () => {
      const messages = lint("const x = process.env.FOO;");
      expect(messages[0].severity).toBe(2); // error
    });
  });

  describe("line / column reporting", () => {
    it("reports the line where process.env appears", () => {
      const messages = lint("const x = process.env.FOO;");
      expect(messages[0].line).toBe(1);
    });

    it("reports a sensible column", () => {
      const messages = lint("const x = process.env.FOO;");
      // "process.env" starts at column 11 (0-indexed in the AST)
      expect(messages[0].column).toBeGreaterThan(0);
    });

    it("reports the correct line for process.env in multi-line code", () => {
      const messages = lint("const a = 1;\nconst b = process.env.X;\nconst c = 3;");
      expect(messages).toHaveLength(1);
      expect(messages[0].line).toBe(2);
    });

    it("reports each occurrence on its own line", () => {
      const messages = lint("const a = process.env.X;\nconst b = process.env.Y;");
      expect(messages).toHaveLength(2);
      expect(messages[0].line).toBe(1);
      expect(messages[1].line).toBe(2);
    });
  });

  describe("multiple violations", () => {
    it("flags multiple process.env usages in one expression", () => {
      const messages = lint("const a = process.env.X + process.env.Y;");
      expect(messages).toHaveLength(2);
      messages.forEach((m) => expect(m.ruleId).toBe("no-restricted-syntax"));
    });

    it("flags every process.env in a block", () => {
      const messages = lint(`{
  const a = process.env.A;
  const b = process.env.B;
  const c = process.env.C;
}`);
      expect(messages).toHaveLength(3);
    });
  });
});

// ---------------------------------------------------------------
// Should NOT flag
// ---------------------------------------------------------------

describe("no-restricted-syntax: false negatives", () => {
  it("does not flag process (without .env)", () => {
    const messages = lint("const x = process;");
    expect(messages).toHaveLength(0);
  });

  it("does not flag process.cwd()", () => {
    const messages = lint("const cwd = process.cwd();");
    expect(messages).toHaveLength(0);
  });

  it("does not flag process.exit()", () => {
    const messages = lint("process.exit(1);");
    expect(messages).toHaveLength(0);
  });

  it("does not flag process.version", () => {
    const messages = lint("const v = process.version;");
    expect(messages).toHaveLength(0);
  });

  it("does not flag other .env objects (not process)", () => {
    const messages = lint("const x = window.env;");
    expect(messages).toHaveLength(0);
  });

  it("does not flag app.env", () => {
    const messages = lint("const x = app.env;");
    expect(messages).toHaveLength(0);
  });

  it("does not flag myApp.process.env (nested under another object)", () => {
    // The selector requires object.name === 'process' at the top level.
    const messages = lint("const x = myApp.process.env;");
    expect(messages).toHaveLength(0);
  });

  it("does not flag a string containing 'process.env'", () => {
    const messages = lint("const msg = 'process.env is forbidden';");
    expect(messages).toHaveLength(0);
  });

  it("does not flag an import of the env singleton", () => {
    const messages = lint("import { env } from '../lib/config/env';");
    expect(messages).toHaveLength(0);
  });

  it("does not flag a variable named env used standalone", () => {
    const messages = lint("const url = env.apiUrl;");
    expect(messages).toHaveLength(0);
  });

  it("does not flag simple arithmetic", () => {
    const messages = lint("const x = 1 + 2;");
    expect(messages).toHaveLength(0);
  });

  it("does not flag function declarations", () => {
    const messages = lint("function foo() { return 42; }");
    expect(messages).toHaveLength(0);
  });

  it("does not flag template literals without process.env", () => {
    const messages = lint("const url = `${base}/api`;");
    expect(messages).toHaveLength(0);
  });
});
