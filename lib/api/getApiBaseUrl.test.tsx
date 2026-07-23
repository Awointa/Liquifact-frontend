import { getApiBaseUrl } from "./getApiBaseUrl";
import fs from "fs";
import path from "path";

describe("getApiBaseUrl", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Make a shallow copy of process.env to restore later
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
  });

  it("returns default URL when NEXT_PUBLIC_API_URL is unset", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe("http://localhost:3001");
  });

  it("returns default URL when NEXT_PUBLIC_API_URL is an empty string", () => {
    process.env.NEXT_PUBLIC_API_URL = "";
    expect(getApiBaseUrl()).toBe("http://localhost:3001");
  });

  it("returns default URL when NEXT_PUBLIC_API_URL contains only whitespace", () => {
    process.env.NEXT_PUBLIC_API_URL = "   ";
    expect(getApiBaseUrl()).toBe("http://localhost:3001");
  });

  it("strips single trailing slash", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.liquifact.io/";
    expect(getApiBaseUrl()).toBe("https://api.liquifact.io");
  });

  it("strips multiple trailing slashes", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.liquifact.io///";
    expect(getApiBaseUrl()).toBe("https://api.liquifact.io");
  });

  it("strips trailing slashes with a path prefix", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.liquifact.io/v1/api///";
    expect(getApiBaseUrl()).toBe("https://api.liquifact.io/v1/api");
  });

  it("handles valid URL with path prefix and no trailing slashes", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.liquifact.io/v1/api";
    expect(getApiBaseUrl()).toBe("https://api.liquifact.io/v1/api");
  });

  it("handles whitespace surrounding a valid URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "  https://api.liquifact.io/v1/api//  ";
    expect(getApiBaseUrl()).toBe("https://api.liquifact.io/v1/api");
  });

  it("throws error for invalid URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "invalid-url";
    expect(() => getApiBaseUrl()).toThrow(
      '[getApiBaseUrl] NEXT_PUBLIC_API_URL is set but is not a valid URL: "invalid-url"'
    );
  });

  it("asserts that default fallback matches .env.local.example", () => {
    const examplePath = path.resolve(__dirname, "../../.env.local.example");
    const exampleContent = fs.readFileSync(examplePath, "utf-8");

    // Look for NEXT_PUBLIC_API_URL=... in .env.local.example
    const match = exampleContent.match(/^NEXT_PUBLIC_API_URL=(.+)$/m);
    expect(match).not.toBeNull();
    const envDefault = match![1].trim();

    expect(envDefault).toBe("http://localhost:3001");
  });
});
