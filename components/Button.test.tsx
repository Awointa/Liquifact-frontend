import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import "@testing-library/jest-dom";

import Button from "./Button";
import Spinner from "./Spinner";

expect.extend(toHaveNoViolations);

describe("Button", () => {
  // ── Basic rendering ─────────────────────────────────────────────────────
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("renders with no children", () => {
    const { container } = render(<Button aria-label="icon-only" />);
    expect(container.querySelector("button")).toBeInTheDocument();
  });

  it("defaults to type='button' to prevent form submission", () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("allows overriding type prop", () => {
    render(
      <Button type="submit" data-testid="submit-btn">
        Submit
      </Button>
    );
    expect(screen.getByTestId("submit-btn")).toHaveAttribute("type", "submit");
  });

  // ── Ref forwarding ──────────────────────────────────────────────────────
  it("forwards ref to the DOM button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("ref.current has the correct tagName", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref test</Button>);
    expect(ref.current?.tagName).toBe("BUTTON");
  });

  // ── Prop forwarding ─────────────────────────────────────────────────────
  it("forwards additional props", () => {
    render(<Button data-testid="my-btn">Props test</Button>);
    expect(screen.getByTestId("my-btn")).toBeInTheDocument();
  });

  it("forwards aria-label", () => {
    render(<Button aria-label="Custom label">Label</Button>);
    expect(screen.getByRole("button", { name: "Custom label" })).toBeInTheDocument();
  });

  it("forwards aria-describedby", () => {
    render(<Button aria-describedby="helper">Help me</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-describedby", "helper");
  });

  it("forwards data attributes", () => {
    render(
      <Button data-variant="test" data-custom="value">
        Data test
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("data-variant", "test");
    expect(btn).toHaveAttribute("data-custom", "value");
  });

  // ── Variants ────────────────────────────────────────────────────────────
  const variants = ["primary", "secondary", "warning", "external", "danger"] as const;

  it.each(variants)("renders %s variant without visual regressions", (variant) => {
    const { container } = render(<Button variant={variant}>{variant}</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it.each(variants)("applies %s variant styles", (variant) => {
    render(<Button variant={variant}>{variant}</Button>);
    const btn = screen.getByRole("button");
    const expectedClass =
      variant === "primary"
        ? "bg-cyan-500"
        : variant === "secondary"
          ? "bg-slate-800"
          : variant === "warning"
            ? "bg-amber-500"
            : variant === "external"
              ? "bg-violet-500"
              : "bg-red-500";
    expect(btn.className).toContain(expectedClass);
  });

  it.each(variants)("has correct text colour for %s variant", (variant) => {
    render(<Button variant={variant}>{variant}</Button>);
    const btn = screen.getByRole("button");
    const expectedTextColor =
      variant === "primary"
        ? "text-slate-950"
        : variant === "secondary"
          ? "text-slate-200"
          : variant === "warning"
            ? "text-slate-950"
            : variant === "external"
              ? "text-white"
              : "text-white";
    expect(btn.className).toContain(expectedTextColor);
  });

  it("defaults to primary variant", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-cyan-500");
  });

  // ── Focus-ring consistency ──────────────────────────────────────────────
  it("has consistent focus-ring class across all variants", () => {
    const variants = ["primary", "secondary", "warning", "external", "danger"] as const;
    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      const btn = screen.getByRole("button");
      expect(btn.className).toContain("focus-ring");
      unmount();
    }
  });

  // ── Disabled state ──────────────────────────────────────────────────────
  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("opacity-50");
    expect(btn.className).toContain("cursor-not-allowed");
  });

  it("applies disabled classes when loading", () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("opacity-50");
    expect(btn.className).toContain("cursor-not-allowed");
  });

  it("is disabled when both loading and disabled are true", () => {
    render(
      <Button loading disabled>
        Both
      </Button>
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards disabled attribute when loading", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  // ── Loading state ───────────────────────────────────────────────────────
  it("is disabled and shows spinner when loading", () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn.querySelector("svg")).toBeInTheDocument();
  });

  it("sets aria-busy to true when loading", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("sets aria-busy to false when not loading", () => {
    render(<Button>Not loading</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "false");
  });

  it("does not show spinner when not loading", () => {
    render(<Button>Not loading</Button>);
    expect(screen.getByRole("button").querySelector("svg")).not.toBeInTheDocument();
  });

  it("shows spinner alongside children when loading", () => {
    render(<Button loading>Loading text</Button>);
    const btn = screen.getByRole("button");
    expect(btn.querySelector("svg")).toBeInTheDocument();
    expect(btn).toHaveTextContent("Loading text");
  });

  it("spinner has correct size classes", () => {
    render(<Button loading>Loading</Button>);
    const svg = screen.getByRole("button").querySelector("svg");
    expect(svg).toHaveClass("h-4");
    expect(svg).toHaveClass("w-4");
  });

  // ── Click handling ──────────────────────────────────────────────────────
  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} disabled>
        Click
      </Button>
    );
    await user.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when loading", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} loading>
        Click
      </Button>
    );
    await user.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  // ── Keyboard interaction ────────────────────────────────────────────────
  it("responds to keyboard activation (Enter)", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("responds to keyboard activation (Space)", async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await user.tab();
    await user.keyboard(" ");
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // ── className merging ───────────────────────────────────────────────────
  it("appends custom className after base styles", () => {
    render(<Button className="w-full">Wide</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("w-full");
    expect(btn.className).toContain("focus-ring");
  });

  it("handles empty className gracefully", () => {
    render(<Button className="">Empty</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).not.toContain("  "); // no double spaces
  });

  // ── Accessibility ───────────────────────────────────────────────────────
  it("has no accessibility violations", async () => {
    const { container } = render(<Button>Accessible</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no a11y violations when loading", async () => {
    const { container } = render(<Button loading>Loading</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no a11y violations when disabled", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no a11y violations for each variant", async () => {
    for (const variant of variants) {
      const { container, unmount } = render(<Button variant={variant}>{variant}</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      unmount();
    }
  });

  it("is keyboard focusable", async () => {
    render(<Button>Focusable</Button>);
    const btn = screen.getByRole("button");
    expect(btn.tabIndex).toBe(0);
  });

  it("is disabled and not interactive when disabled", () => {
    render(<Button disabled>Not focusable</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    // Native disabled buttons have tabIndex -1 in the DOM
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────
  it("handles variant prop that is undefined", () => {
    render(<Button variant={undefined as any}>Undefined variant</Button>);
    const btn = screen.getByRole("button");
    // Should fall back to primary
    expect(btn.className).toContain("bg-cyan-500");
  });

  it("handles variant prop that is an unknown string", () => {
    render(<Button variant={"unknown" as any}>Unknown variant</Button>);
    const btn = screen.getByRole("button");
    // Should fall back to primary
    expect(btn.className).toContain("bg-cyan-500");
  });

  it("renders with complex children (nested elements)", () => {
    render(
      <Button>
        <span>Icon</span>
        <span>Text</span>
      </Button>
    );
    expect(screen.getByText("Icon")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
  });

  it("renders with numeric children", () => {
    render(<Button>42</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("42");
  });

  it("has displayName for debugging", () => {
    expect(Button.displayName).toBe("Button");
  });
});

describe("Spinner", () => {
  it("renders an animated SVG", () => {
    render(<Spinner />);
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("animate-spin");
  });

  it("is aria-hidden", () => {
    render(<Spinner />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("accepts custom className", () => {
    render(<Spinner className="h-8 w-8" />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("h-8");
    expect(svg).toHaveClass("w-8");
  });

  it("has default className h-4 w-4", () => {
    render(<Spinner />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("h-4");
    expect(svg).toHaveClass("w-4");
  });

  it("renders with inline class", () => {
    render(<Spinner />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("inline");
  });

  it("has correct SVG namespace", () => {
    render(<Spinner />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");
  });

  it("has correct viewBox", () => {
    render(<Spinner />);
    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
  });

  it("forwards additional props to SVG", () => {
    render(<Spinner data-testid="spinner" />);
    expect(document.querySelector("[data-testid='spinner']")).toBeInTheDocument();
  });

  it("does not appear in the accessibility tree", () => {
    render(<Spinner />);
    // aria-hidden="true" means it should not be visible to screen readers
    const svg = document.querySelector("svg");
    expect(svg).not.toHaveAttribute("role");
    expect(svg?.textContent).toBe(""); // no accessible text
  });

  it("contains circle and path elements", () => {
    render(<Spinner />);
    const circle = document.querySelector("circle");
    const path = document.querySelector("path");
    expect(circle).toBeInTheDocument();
    expect(path).toBeInTheDocument();
  });

  it("circle has opacity-25 class", () => {
    render(<Spinner />);
    const circle = document.querySelector("circle");
    expect(circle).toHaveClass("opacity-25");
  });

  it("path has opacity-75 class", () => {
    render(<Spinner />);
    const path = document.querySelector("path");
    expect(path).toHaveClass("opacity-75");
  });
});
