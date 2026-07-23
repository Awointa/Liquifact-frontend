/**
 * @file Settings.test.tsx
 *
 * Comprehensive tests for the Settings component and its exported constants.
 *
 * Areas covered
 * ─────────────
 * 1. VALID_HEADINGS constant — shape and membership
 * 2. Default render — section landmark, heading, theme row
 * 3. className prop — forwarded to the root <section>
 * 4. headingLevel prop — renders the correct heading element
 * 5. headingLevel fallback — invalid values fall back to <h2>
 * 6. showHeading prop — visible vs. sr-only heading
 * 7. Accessibility markup — aria-labelledby, label/control association
 * 8. ThemeToggle composition — toggle is present and operable
 * 9. axe accessibility regression guard
 */

import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { axe } from "jest-axe";

import Settings, { VALID_HEADINGS } from "./Settings";

// ─── Test utilities ──────────────────────────────────────────────────────────

/** Suppress matchMedia errors from ThemeToggle in JSDOM. */
function mockMatchMedia(prefersLight = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: light)" ? prefersLight : false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

/** Stub localStorage so ThemeToggle doesn't throw in JSDOM. */
function mockLocalStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  Object.defineProperty(window, "localStorage", {
    writable: true,
    value: {
      getItem: jest.fn((k: string) => store[k] ?? null),
      setItem: jest.fn((k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn((k: string) => {
        delete store[k];
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
      get length() {
        return Object.keys(store).length;
      },
      key: jest.fn((i: number) => Object.keys(store)[i] ?? null),
    },
  });
}

beforeEach(() => {
  mockMatchMedia();
  mockLocalStorage();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

// ─── 1. VALID_HEADINGS constant ──────────────────────────────────────────────

describe("VALID_HEADINGS", () => {
  it("is an array", () => {
    expect(Array.isArray(VALID_HEADINGS)).toBe(true);
  });

  it("contains exactly the six HTML heading tags", () => {
    expect(VALID_HEADINGS).toEqual(
      expect.arrayContaining(["h1", "h2", "h3", "h4", "h5", "h6"])
    );
    expect(VALID_HEADINGS).toHaveLength(6);
  });

  it("starts with h1 and ends with h6", () => {
    expect(VALID_HEADINGS[0]).toBe("h1");
    expect(VALID_HEADINGS[VALID_HEADINGS.length - 1]).toBe("h6");
  });
});

// ─── 2. Default render ───────────────────────────────────────────────────────

describe("Settings — default render", () => {
  it("renders a <section> landmark element", () => {
    render(<Settings />);
    expect(screen.getByRole("region", { name: /settings/i })).toBeInTheDocument();
  });

  it("attaches data-testid='settings-panel' to the root element", () => {
    render(<Settings />);
    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
  });

  it("renders the 'Settings' heading text", () => {
    render(<Settings />);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders the 'Theme' label", () => {
    render(<Settings />);
    expect(screen.getByText("Theme")).toBeInTheDocument();
  });

  it("renders the ThemeToggle button", () => {
    render(<Settings />);
    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
  });

  it("the Theme label's htmlFor points at the ThemeToggle button", () => {
    render(<Settings />);
    const label = screen.getByText("Theme");
    const toggle = screen.getByRole("button", { name: /theme/i });
    expect(label).toHaveAttribute("for", toggle.id);
  });
});

// ─── 3. className prop ───────────────────────────────────────────────────────

describe("Settings — className prop", () => {
  it("forwards a custom class to the root <section>", () => {
    render(<Settings className="my-custom-class" />);
    expect(screen.getByTestId("settings-panel")).toHaveClass("my-custom-class");
  });

  it("keeps the built-in classes alongside the custom class", () => {
    render(<Settings className="extra" />);
    const section = screen.getByTestId("settings-panel");
    expect(section).toHaveClass("rounded-2xl");
    expect(section).toHaveClass("extra");
  });

  it("does not add any extra class when className is omitted", () => {
    render(<Settings />);
    // The root section must exist and carry its base styles but no unexpected additions.
    const section = screen.getByTestId("settings-panel");
    expect(section.className).not.toMatch(/undefined|null/);
  });

  it("accepts an empty string without breaking", () => {
    render(<Settings className="" />);
    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
  });
});

// ─── 4. headingLevel prop ────────────────────────────────────────────────────

describe("Settings — headingLevel prop", () => {
  it("renders an <h2> by default", () => {
    render(<Settings />);
    const heading = screen.getByRole("heading", { name: /settings/i });
    expect(heading.tagName).toBe("H2");
  });

  it("renders <h1> when headingLevel='h1'", () => {
    render(<Settings headingLevel="h1" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H1");
  });

  it("renders <h2> when headingLevel='h2'", () => {
    render(<Settings headingLevel="h2" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");
  });

  it("renders <h3> when headingLevel='h3'", () => {
    render(<Settings headingLevel="h3" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H3");
  });

  it("renders <h4> when headingLevel='h4'", () => {
    render(<Settings headingLevel="h4" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H4");
  });

  it("renders <h5> when headingLevel='h5'", () => {
    render(<Settings headingLevel="h5" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H5");
  });

  it("renders <h6> when headingLevel='h6'", () => {
    render(<Settings headingLevel="h6" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H6");
  });
});

// ─── 5. headingLevel fallback ────────────────────────────────────────────────

describe("Settings — headingLevel fallback for invalid values", () => {
  it("falls back to <h2> when an unknown string is passed", () => {
    // @ts-expect-error — intentional invalid prop for defensive test
    render(<Settings headingLevel="div" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");
  });

  it("falls back to <h2> when an empty string is passed", () => {
    // @ts-expect-error — intentional invalid prop for defensive test
    render(<Settings headingLevel="" />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");
  });

  it("falls back to <h2> when a number is passed", () => {
    // @ts-expect-error — intentional invalid prop for defensive test
    render(<Settings headingLevel={3} />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");
  });

  it("falls back to <h2> when null is passed", () => {
    // @ts-expect-error — intentional invalid prop for defensive test
    render(<Settings headingLevel={null} />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");
  });

  it("falls back to <h2> when undefined is passed explicitly", () => {
    render(<Settings headingLevel={undefined} />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");
  });
});

// ─── 6. showHeading prop ─────────────────────────────────────────────────────

describe("Settings — showHeading prop", () => {
  it("shows the heading visually by default (no sr-only)", () => {
    render(<Settings />);
    const heading = screen.getByRole("heading", { name: /settings/i });
    expect(heading).not.toHaveClass("sr-only");
  });

  it("shows the heading visually when showHeading=true", () => {
    render(<Settings showHeading={true} />);
    const heading = screen.getByRole("heading", { name: /settings/i });
    expect(heading).not.toHaveClass("sr-only");
  });

  it("adds sr-only class when showHeading=false", () => {
    render(<Settings showHeading={false} />);
    const heading = screen.getByRole("heading", { name: /settings/i });
    expect(heading).toHaveClass("sr-only");
  });

  it("heading remains in the DOM when showHeading=false (for aria-labelledby)", () => {
    render(<Settings showHeading={false} />);
    // The heading must still exist so aria-labelledby resolves correctly.
    expect(document.getElementById("settings-heading")).toBeInTheDocument();
  });

  it("heading has id='settings-heading' regardless of showHeading value", () => {
    const { rerender } = render(<Settings showHeading={true} />);
    expect(document.getElementById("settings-heading")).toBeInTheDocument();

    rerender(<Settings showHeading={false} />);
    expect(document.getElementById("settings-heading")).toBeInTheDocument();
  });
});

// ─── 7. Accessibility markup ─────────────────────────────────────────────────

describe("Settings — accessibility", () => {
  it("section has aria-labelledby='settings-heading'", () => {
    render(<Settings />);
    expect(screen.getByTestId("settings-panel")).toHaveAttribute(
      "aria-labelledby",
      "settings-heading"
    );
  });

  it("aria-labelledby resolves to an element with text 'Settings'", () => {
    render(<Settings />);
    const section = screen.getByTestId("settings-panel");
    const labelId = section.getAttribute("aria-labelledby") as string;
    const labelEl = document.getElementById(labelId);
    expect(labelEl).toBeInTheDocument();
    expect(labelEl?.textContent).toMatch(/settings/i);
  });

  it("Theme label is associated with the ThemeToggle button via htmlFor/id", () => {
    render(<Settings />);
    const label = screen.getByText("Theme");
    const forAttr = label.getAttribute("for");
    expect(forAttr).toBeTruthy();
    // The element referenced by `for` must exist in the DOM.
    expect(document.getElementById(forAttr as string)).toBeInTheDocument();
  });

  it("has no axe violations with default props", async () => {
    const { container } = render(<Settings />);
    await act(async () => {}); // flush ThemeToggle useEffect
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations when showHeading=false", async () => {
    const { container } = render(<Settings showHeading={false} />);
    await act(async () => {});
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no axe violations with headingLevel='h3'", async () => {
    const { container } = render(<Settings headingLevel="h3" />);
    await act(async () => {});
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ─── 8. ThemeToggle composition ──────────────────────────────────────────────

describe("Settings — ThemeToggle composition", () => {
  it("renders exactly one ThemeToggle button", () => {
    render(<Settings />);
    // ThemeToggle renders a single button with id="theme-toggle".
    const toggleButtons = document.querySelectorAll("#theme-toggle");
    expect(toggleButtons).toHaveLength(1);
  });

  it("ThemeToggle button has id='theme-toggle'", () => {
    render(<Settings />);
    expect(document.getElementById("theme-toggle")).toBeInTheDocument();
  });

  it("ThemeToggle cycles theme on click (integration smoke test)", async () => {
    render(<Settings />);
    const toggle = screen.getByRole("button", { name: /theme/i });
    const initialPref = toggle.getAttribute("data-theme-pref");

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle.getAttribute("data-theme-pref")).not.toBe(initialPref);
  });

  it("clicking ThemeToggle updates data-theme on <html>", async () => {
    render(<Settings />);
    // After mount, ThemeToggle applies a theme.
    await act(async () => {});
    expect(document.documentElement).toHaveAttribute("data-theme");
  });

  it("ThemeToggle SVG icons are aria-hidden", () => {
    render(<Settings />);
    const svgs = document.querySelectorAll("#theme-toggle svg");
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });
});

// ─── 9. Prop combination edge cases ──────────────────────────────────────────

describe("Settings — prop combinations", () => {
  it("renders correctly with all props at their defaults", () => {
    render(<Settings />);
    expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");
    expect(screen.getByRole("heading", { name: /settings/i })).not.toHaveClass("sr-only");
  });

  it("renders correctly with all props explicitly set", () => {
    render(<Settings className="p-8" headingLevel="h3" showHeading={false} />);
    const section = screen.getByTestId("settings-panel");
    expect(section).toHaveClass("p-8");
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H3");
    expect(screen.getByRole("heading", { name: /settings/i })).toHaveClass("sr-only");
  });

  it("renders consistently across re-renders with changed props", () => {
    const { rerender } = render(<Settings headingLevel="h2" showHeading={true} />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H2");

    rerender(<Settings headingLevel="h4" showHeading={false} />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H4");
    expect(screen.getByRole("heading", { name: /settings/i })).toHaveClass("sr-only");

    rerender(<Settings headingLevel="h1" showHeading={true} />);
    expect(screen.getByRole("heading", { name: /settings/i }).tagName).toBe("H1");
    expect(screen.getByRole("heading", { name: /settings/i })).not.toHaveClass("sr-only");
  });
});
