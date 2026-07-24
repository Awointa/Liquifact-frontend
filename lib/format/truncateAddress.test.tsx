import { truncateAddress } from "./truncateAddress";

describe("truncateAddress - below the truncation threshold", () => {
  it.each([
    { label: "short address", address: "GABCD123" },
    { label: "single character", address: "G" },
  ])("returns $label unchanged", ({ address }) => {
    expect(truncateAddress(address)).toBe(address);
  });
});

describe("truncateAddress - exact boundary lengths (default headLen=6, tailLen=4)", () => {
  it("returns an address of exactly headLen+tailLen+1 (11) chars unchanged", () => {
    const address = "GABCDEFGHIJ";
    expect(address).toHaveLength(11);
    expect(truncateAddress(address)).toBe(address);
  });

  it("truncates an address one char past the boundary (12 chars)", () => {
    const address = "GABCDEFGHIJK";
    expect(address).toHaveLength(12);
    expect(truncateAddress(address)).toBe("GABCDE…HIJK");
  });
});

describe("truncateAddress - custom headLen/tailLen", () => {
  it("returns unchanged when exactly at a custom boundary", () => {
    expect(truncateAddress("ABCDEF", 3, 2)).toBe("ABCDEF");
  });

  it("truncates once past a custom boundary", () => {
    expect(truncateAddress("ABCDEFG", 3, 2)).toBe("ABC…FG");
  });
});

describe("truncateAddress - realistic Stellar address", () => {
  it("truncates a 56-char G-address to head…tail", () => {
    const address = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
    expect(address).toHaveLength(56);
    expect(truncateAddress(address)).toBe("GDQP2K…4W37");
  });

  it("uses a single ellipsis character (…), not three dots", () => {
    const result = truncateAddress("GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37");
    expect(result).toContain("…");
    expect(result).not.toContain("...");
  });
});

describe("truncateAddress - non-string inputs", () => {
  it.each([
    { label: "null", address: null },
    { label: "undefined", address: undefined },
    { label: "empty string", address: "" },
    { label: "number", address: 123456789012 },
    { label: "plain object", address: { address: "GABCDEFGHIJK" } },
    { label: "array", address: ["G", "A", "B"] },
    { label: "boolean", address: true },
  ])("returns an empty string for $label", ({ address }) => {
    expect(truncateAddress(address as unknown as string)).toBe("");
  });
});
