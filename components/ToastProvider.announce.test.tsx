/**
 * Tests for the polite aria-live announcer added in issue #555.
 *
 * Focus: the offscreen announcer `div` (data-testid="toast-announcer"), the
 * `getAnnouncementText` helper, and the debounced effect inside ToastProvider.
 *
 * What is NOT tested here (covered by ToastProvider.test.tsx and
 * ToastProvider.dedupe.test.tsx): toast rendering, auto-dismiss, pause/resume,
 * focus management, and the ToastViewport live region.
 */

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  ANNOUNCE_DEBOUNCE_MS,
  ToastProvider,
  getAnnouncementText,
  useToast,
} from "./ToastProvider";

// ---------------------------------------------------------------------------
// Pure helper: getAnnouncementText
// ---------------------------------------------------------------------------

describe("getAnnouncementText (pure helper)", () => {
  it("returns empty string for an empty array", () => {
    expect(getAnnouncementText([])).toBe("");
  });

  it("returns empty string for null / undefined", () => {
    expect(getAnnouncementText(null as any)).toBe("");
    expect(getAnnouncementText(undefined as any)).toBe("");
  });

  it("uses singular 'notification' for a single toast", () => {
    const toasts = [{ title: "Saved" }];
    expect(getAnnouncementText(toasts as any)).toBe("1 notification: Saved");
  });

  it("uses plural 'notifications' for two or more toasts", () => {
    const toasts = [{ title: "Alpha" }, { title: "Beta" }];
    expect(getAnnouncementText(toasts as any)).toBe("2 notifications: Alpha, Beta");
  });

  it("lists all toast titles separated by commas", () => {
    const toasts = [{ title: "A" }, { title: "B" }, { title: "C" }];
    expect(getAnnouncementText(toasts as any)).toBe("3 notifications: A, B, C");
  });
});

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

function ToastHarness() {
  const toast = useToast();
  return (
    <div>
      <button type="button" onClick={() => toast.success("Action complete")}>
        Trigger success
      </button>
      <button type="button" onClick={() => toast.error("Something went wrong")}>
        Trigger error
      </button>
      <button type="button" onClick={() => toast.info("FYI message", "Info title")}>
        Trigger info
      </button>
      <button type="button" onClick={() => toast.success("Toast A", "Alpha")}>
        Trigger alpha
      </button>
      <button type="button" onClick={() => toast.success("Toast B", "Beta")}>
        Trigger beta
      </button>
      <button type="button" onClick={() => toast.success("Toast C", "Gamma")}>
        Trigger gamma
      </button>
      <button type="button" onClick={() => toast.success("Toast D", "Delta")}>
        Trigger delta
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>
  );
}

/** Returns the single offscreen announcer div. */
function getAnnouncer() {
  return screen.getByTestId("toast-announcer");
}

// ---------------------------------------------------------------------------
// Integration: ToastProvider announcer behaviour
// ---------------------------------------------------------------------------

describe("ToastProvider — aria-live announcer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ---- DOM attributes -------------------------------------------------------

  it("renders the announcer with role=status, aria-live=polite, aria-atomic=true", () => {
    renderWithProvider();
    const announcer = getAnnouncer();
    expect(announcer).toHaveAttribute("role", "status");
    expect(announcer).toHaveAttribute("aria-live", "polite");
    expect(announcer).toHaveAttribute("aria-atomic", "true");
  });

  it("renders the announcer with the sr-only class so it is visually hidden", () => {
    renderWithProvider();
    expect(getAnnouncer()).toHaveClass("sr-only");
  });

  // ---- No announcement on initial mount ------------------------------------

  it("does NOT announce on initial mount (announcer is empty)", () => {
    renderWithProvider();
    expect(getAnnouncer()).toHaveTextContent("");
  });

  // ---- Announcement after debounce -----------------------------------------

  it("announces after the debounce window when a toast is added", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));
    });

    // Before debounce settles — still empty.
    expect(getAnnouncer()).toHaveTextContent("");

    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    expect(getAnnouncer()).toHaveTextContent("1 notification: Success");
  });

  it("uses the custom title when provided", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger info" }));
    });

    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    expect(getAnnouncer()).toHaveTextContent("1 notification: Info title");
  });

  // ---- Debounce collapses rapid updates ------------------------------------

  it("collapses rapid successive additions into a single announcement", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger alpha" }));
      fireEvent.click(screen.getByRole("button", { name: "Trigger beta" }));
      fireEvent.click(screen.getByRole("button", { name: "Trigger gamma" }));
    });

    // Still nothing before debounce settles.
    expect(getAnnouncer()).toHaveTextContent("");

    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    // Should announce all three in one go (newest-first order in stack).
    const text = getAnnouncer().textContent ?? "";
    expect(text).toMatch(/^3 notifications:/);
    expect(text).toContain("Gamma");
    expect(text).toContain("Beta");
    expect(text).toContain("Alpha");
  });

  it("does not fire a second announcement when a partial debounce timer is still pending", () => {
    const setStateSpy = jest.fn();
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger alpha" }));
    });

    // Advance only halfway — debounce has not yet fired.
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS / 2);
    });

    expect(getAnnouncer()).toHaveTextContent("");

    // Trigger a second toast — this should reset the debounce.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger beta" }));
    });

    // Advance another half period — original timer would have fired but was cancelled.
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS / 2);
    });

    // Still silent because the reset timer hasn't fired yet.
    expect(getAnnouncer()).toHaveTextContent("");

    // Now let the reset timer complete.
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    const text = getAnnouncer().textContent ?? "";
    expect(text).toMatch(/^2 notifications:/);
  });

  // ---- Multiple separate announcements (non-rapid) -------------------------

  it("produces a new announcement for each non-overlapping toast addition", () => {
    renderWithProvider();

    // First toast + settle.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger alpha" }));
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });
    expect(getAnnouncer()).toHaveTextContent("1 notification: Alpha");

    // Second toast + settle.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger beta" }));
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });
    expect(getAnnouncer()).toHaveTextContent("2 notifications: Beta, Alpha");
  });

  // ---- Toast dismissed → announcement clears --------------------------------

  it("clears the announcement text when the last toast is dismissed", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });
    expect(getAnnouncer()).not.toHaveTextContent("");

    // Dismiss the toast.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    expect(getAnnouncer()).toHaveTextContent("");
  });

  it("updates the announcement when one of several toasts is dismissed", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger alpha" }));
      fireEvent.click(screen.getByRole("button", { name: "Trigger beta" }));
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });
    expect(getAnnouncer().textContent).toMatch(/^2 notifications:/);

    // Dismiss the first visible toast (the most-recently added, at index 0).
    const dismissButtons = screen.getAllByRole("button", { name: "Dismiss notification" });
    act(() => {
      fireEvent.click(dismissButtons[0]);
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    expect(getAnnouncer()).toHaveTextContent("1 notification: Alpha");
  });

  // ---- Auto-dismiss → announcement clears -----------------------------------

  it("clears the announcement after a toast auto-dismisses", () => {
    const AUTO_DISMISS_MS = 5000;
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });
    expect(getAnnouncer()).not.toHaveTextContent("");

    // Let the auto-dismiss fire.
    act(() => {
      jest.advanceTimersByTime(AUTO_DISMISS_MS);
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    expect(getAnnouncer()).toHaveTextContent("");
  });

  // ---- Queue cap (MAX_TOASTS = 3) ------------------------------------------

  it("announces the capped 3-toast stack after evicting the oldest", () => {
    renderWithProvider();

    // Add 4 toasts; the oldest (Alpha) should be evicted.
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger alpha" }));
      fireEvent.click(screen.getByRole("button", { name: "Trigger beta" }));
      fireEvent.click(screen.getByRole("button", { name: "Trigger gamma" }));
      fireEvent.click(screen.getByRole("button", { name: "Trigger delta" }));
    });
    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    const text = getAnnouncer().textContent ?? "";
    expect(text).toMatch(/^3 notifications:/);
    expect(text).toContain("Delta");
    expect(text).toContain("Gamma");
    expect(text).toContain("Beta");
    expect(text).not.toContain("Alpha");
  });

  // ---- Unmount cleans up the debounce timer --------------------------------

  it("cancels any pending debounce timer on unmount", () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    const { unmount } = renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));
    });

    // Unmount before the debounce timer fires.
    act(() => {
      unmount();
    });

    // The debounce cleanup should have called clearTimeout.
    expect(clearTimeoutSpy).toHaveBeenCalled();
    // Timer count should be zero — nothing left running.
    expect(jest.getTimerCount()).toBe(0);
  });

  // ---- No announcement before debounce window (timing boundary) -----------

  it("does not announce before ANNOUNCE_DEBOUNCE_MS - 1 ms", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));
    });

    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS - 1);
    });

    expect(getAnnouncer()).toHaveTextContent("");
  });

  it("announces exactly at ANNOUNCE_DEBOUNCE_MS", () => {
    renderWithProvider();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));
    });

    act(() => {
      jest.advanceTimersByTime(ANNOUNCE_DEBOUNCE_MS);
    });

    expect(getAnnouncer()).not.toHaveTextContent("");
  });
});
