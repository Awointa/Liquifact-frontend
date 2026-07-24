import { formatInvoiceDate, INVALID_DATE_FALLBACK } from "./date";
import { DEFAULT_LOCALE } from "./config";

// Every case that asserts a hardcoded string pins timeZone: "UTC" in the
// format options so the expectation doesn't depend on the host machine's
// (or CI runner's) local timezone.
const UTC_SHORT = { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" } as const;

describe("formatInvoiceDate - value types", () => {
  it.each([
    { label: "ISO date-only string", value: "2024-03-15", expected: "Mar 15, 2024" },
    { label: "ISO datetime string with Z", value: "2024-03-15T10:30:00Z", expected: "Mar 15, 2024" },
    { label: "Date object", value: new Date("2024-06-01T00:00:00Z"), expected: "Jun 1, 2024" },
    { label: "epoch number (ms)", value: 1717200000000, expected: "Jun 1, 2024" },
  ])("formats $label", ({ value, expected }) => {
    expect(formatInvoiceDate(value, { format: UTC_SHORT })).toBe(expected);
  });
});

describe("formatInvoiceDate - invalid/missing input", () => {
  it.each([
    { label: "null", value: null },
    { label: "undefined", value: undefined },
    { label: "empty string", value: "" },
    { label: "unparseable string", value: "not-a-date" },
    { label: "invalid Date object", value: new Date("not-a-date") },
    { label: "plain object", value: {} as unknown as string },
    { label: "array", value: [] as unknown as string },
    { label: "boolean", value: true as unknown as string },
  ])("returns the fallback for $label", ({ value }) => {
    expect(formatInvoiceDate(value, { format: UTC_SHORT })).toBe(INVALID_DATE_FALLBACK);
  });

  it("returns the fallback when the resolved Intl format options are invalid", () => {
    expect(
      formatInvoiceDate("2024-03-15", {
        format: { month: "invalid-enum" } as unknown as Intl.DateTimeFormatOptions,
      })
    ).toBe(INVALID_DATE_FALLBACK);
  });
});

describe("formatInvoiceDate - locale", () => {
  it("formats using a non-default locale", () => {
    expect(
      formatInvoiceDate("2024-03-15", {
        locale: "fr-FR",
        format: { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
      })
    ).toBe("15 mars 2024");
  });

  it("defaults to en-US when no locale is given", () => {
    expect(DEFAULT_LOCALE).toBe("en-US");
    expect(formatInvoiceDate("2024-03-15", { format: UTC_SHORT })).toBe("Mar 15, 2024");
  });
});

describe("formatInvoiceDate - format options", () => {
  it("honours a custom format shape", () => {
    expect(
      formatInvoiceDate("2024-03-15", {
        format: { year: "2-digit", month: "2-digit", day: "2-digit", timeZone: "UTC" },
      })
    ).toBe("03/15/24");
  });

  it("uses the documented default format (year/month/day) when no options are passed", () => {
    // Deliberately doesn't pin timeZone here: it computes the expected value
    // via the same unpinned Intl call the implementation itself makes, so
    // the assertion holds regardless of which timezone the host is in.
    const instant = new Date("2024-06-01T12:00:00Z");
    const expected = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(instant);

    expect(formatInvoiceDate(instant)).toBe(expected);
  });
});

describe("formatInvoiceDate - timezone stability", () => {
  const instant = "2024-01-01T02:00:00Z";

  it("is stable for a fixed instant + fixed timeZone regardless of how many times it runs", () => {
    const first = formatInvoiceDate(instant, { format: UTC_SHORT });
    const second = formatInvoiceDate(instant, { format: UTC_SHORT });
    expect(first).toBe("Jan 1, 2024");
    expect(second).toBe(first);
  });

  it("respects an explicit non-UTC timeZone instead of silently using UTC", () => {
    const utc = formatInvoiceDate(instant, { format: UTC_SHORT });
    const nyc = formatInvoiceDate(instant, {
      format: { ...UTC_SHORT, timeZone: "America/New_York" },
    });

    // Same instant, different civil date depending on the zone requested.
    expect(utc).toBe("Jan 1, 2024");
    expect(nyc).toBe("Dec 31, 2023");
  });
});

describe("format constants re-export", () => {
  it("re-exports INVALID_DATE_FALLBACK matching the shared config fallback", () => {
    expect(INVALID_DATE_FALLBACK).toBe("—");
  });
});
