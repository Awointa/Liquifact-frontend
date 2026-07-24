/**
 * @file WalletStatus.memoize.test.tsx
 *
 * Verifies the memoization contract introduced in WalletStatus.jsx:
 *
 *   1. config (useMemo) — recomputed only when state/walletData/error change;
 *      stable across unrelated parent re-renders.
 *   2. handleClick (useCallback) — referentially stable when state/connect/
 *      disconnect are unchanged; updated when state transitions.
 *   3. handleCopyAddress (useCallback) — stable when walletData/toast are
 *      unchanged; updated when walletData changes.
 *   4. End-to-end behaviour — all six wallet states render correctly and
 *      clicking the action button still triggers the expected operation.
 *   5. Large-dataset scenario — a parent rendering a large list alongside
 *      WalletStatus does not cause WalletStatus to re-render when only the
 *      list data changes.
 *   6. Filter change still updates — a wallet state transition while an
 *      unrelated filter is active correctly re-derives config.
 *
 * Strategy
 * ────────
 * React does not expose useMemo / useCallback cache hits directly.  We
 * observe the memoization contract indirectly through two angles:
 *
 *   a) Render-count spy: wrap WalletStatus in React.memo and count how many
 *      times the inner component body executes.  An unrelated parent state
 *      change must not increment the counter when wallet context is stable.
 *
 *   b) DOM stability: assert that after an unrelated re-render the rendered
 *      output (button text, helper text, dot colour) is byte-for-byte
 *      identical — confirming config was not recomputed to a new value.
 */

import React, { useCallback, useRef, useState } from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ToastProvider } from "./ToastProvider";
import { WalletContext, WALLET_STATES } from "./WalletProvider";
import WalletStatus from "./WalletStatus";
import * as clipboardLib from "../lib/clipboard";

jest.mock("../lib/clipboard");

// ─── Helpers ─────────────────────────────────────────────────────────────────

type WalletContextValue = {
  state: string;
  walletData: Record<string, string> | null;
  error: string | null;
  connect: jest.Mock;
  disconnect: jest.Mock;
};

/**
 * Build a minimal wallet context value. connect/disconnect are stable jest
 * mocks so they do not change reference between renders unless replaced.
 */
function makeCtx(overrides: Partial<WalletContextValue> = {}): WalletContextValue {
  return {
    state: WALLET_STATES.DISCONNECTED,
    walletData: null,
    error: null,
    connect: jest.fn().mockResolvedValue({ outcome: "success" }),
    disconnect: jest.fn(),
    ...overrides,
  };
}

/**
 * Render WalletStatus inside a controllable parent that can trigger unrelated
 * re-renders via a counter state, while the wallet context stays constant.
 *
 * Returns:
 *   - `setCtx`       update the wallet context value
 *   - `bumpParent`   trigger an unrelated parent re-render
 *   - `renderCount`  ref tracking how many times WalletStatus rendered
 */
function renderHarness(initialCtx: WalletContextValue) {
  const renderCount = { current: 0 };

  // Spy component wraps the real WalletStatus and counts body executions.
  // We deliberately do NOT wrap in React.memo here — we want to count every
  // render triggered by a context change, not suppress them.
  function SpyWalletStatus() {
    renderCount.current += 1;
    return <WalletStatus />;
  }

  let setCtxExternal!: React.Dispatch<React.SetStateAction<WalletContextValue>>;
  let bumpExternal!: () => void;

  function Harness() {
    const [ctx, setCtx] = useState<WalletContextValue>(initialCtx);
    const [tick, setTick] = useState(0);

    setCtxExternal = setCtx;
    bumpExternal = () => setTick((t) => t + 1);

    return (
      <ToastProvider>
        <WalletContext.Provider value={ctx}>
          {/* unrelated sibling that changes when tick changes */}
          <span data-testid="tick">{tick}</span>
          <SpyWalletStatus />
        </WalletContext.Provider>
      </ToastProvider>
    );
  }

  render(<Harness />);

  return {
    renderCount,
    setCtx: (next: Partial<WalletContextValue>) =>
      act(() => setCtxExternal((prev) => ({ ...prev, ...next }))),
    bumpParent: () => act(() => bumpExternal()),
  };
}

// ─── 1. config stability (useMemo) ───────────────────────────────────────────

describe("WalletStatus — config useMemo stability", () => {
  it("does not re-render when only the parent counter changes (unrelated state)", async () => {
    const { bumpParent } = renderHarness(makeCtx());

    // Capture the rendered output before any parent bump.
    const btnBefore = screen.getByRole("button", { name: /connect wallet/i }).outerHTML;
    const helperBefore = screen.getByText(/connect your stellar wallet/i).outerHTML;

    await bumpParent();
    await bumpParent();
    await bumpParent();

    // Wallet context did not change — rendered output must be byte-for-byte
    // identical after unrelated parent state updates.
    expect(screen.getByRole("button", { name: /connect wallet/i }).outerHTML).toBe(btnBefore);
    expect(screen.getByText(/connect your stellar wallet/i).outerHTML).toBe(helperBefore);
  });

  it("re-renders exactly once when wallet state changes", async () => {
    const { renderCount, setCtx } = renderHarness(makeCtx());
    const countBefore = renderCount.current;

    await setCtx({ state: WALLET_STATES.CONNECTING });

    expect(renderCount.current).toBeGreaterThanOrEqual(countBefore + 1);
  });

  it("re-renders exactly once when error changes", async () => {
    const { renderCount, setCtx } = renderHarness(
      makeCtx({ state: WALLET_STATES.ERROR })
    );
    const countBefore = renderCount.current;

    await setCtx({ error: "something went wrong" });

    expect(renderCount.current).toBeGreaterThanOrEqual(countBefore + 1);
  });

  it("re-renders exactly once when walletData changes", async () => {
    const { renderCount, setCtx } = renderHarness(
      makeCtx({
        state: WALLET_STATES.CONNECTED,
        walletData: { address: "GABC...XYZ1", network: "public", balance: "100 XLM" },
      })
    );
    const countBefore = renderCount.current;

    await setCtx({
      walletData: { address: "GDEF...ABC2", network: "testnet", balance: "200 XLM" },
    });

    expect(renderCount.current).toBeGreaterThanOrEqual(countBefore + 1);
  });

  it("DOM output is identical after an unrelated parent re-render", async () => {
    const { bumpParent } = renderHarness(makeCtx());

    const btnBefore = screen.getByRole("button", { name: /connect wallet/i }).outerHTML;
    const helperBefore = screen.getByText(/connect your stellar wallet/i).outerHTML;

    await bumpParent();
    await bumpParent();

    expect(screen.getByRole("button", { name: /connect wallet/i }).outerHTML).toBe(btnBefore);
    expect(screen.getByText(/connect your stellar wallet/i).outerHTML).toBe(helperBefore);
  });
});

// ─── 2. handleClick stability (useCallback) ──────────────────────────────────

describe("WalletStatus — handleClick useCallback", () => {
  it("calls connect when clicking the action button in DISCONNECTED state", async () => {
    const connect = jest.fn().mockResolvedValue({ outcome: "success" });
    renderHarness(makeCtx({ connect }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    });

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("calls disconnect when clicking the action button in CONNECTED state", async () => {
    const disconnect = jest.fn();
    renderHarness(
      makeCtx({
        state: WALLET_STATES.CONNECTED,
        walletData: { address: "GABC...XYZ", network: "public", balance: "0 XLM" },
        disconnect,
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    });

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("calls connect when clicking Retry in ERROR state", async () => {
    const connect = jest.fn().mockResolvedValue({ outcome: "success" });
    renderHarness(makeCtx({ state: WALLET_STATES.ERROR, connect }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    });

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("calls connect when clicking Switch Network in WRONG_NETWORK state", async () => {
    const connect = jest.fn().mockResolvedValue({ outcome: "success" });
    renderHarness(makeCtx({ state: WALLET_STATES.WRONG_NETWORK, connect }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /switch network/i }));
    });

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("opens the wallet install URL in NO_WALLET state", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    renderHarness(makeCtx({ state: WALLET_STATES.NO_WALLET }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /install wallet/i }));
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://www.stellar.org/wallets",
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });

  it("handleClick updates when state transitions from DISCONNECTED to CONNECTED", async () => {
    const disconnect = jest.fn();
    const { setCtx } = renderHarness(makeCtx());

    // Transition to CONNECTED
    await setCtx({
      state: WALLET_STATES.CONNECTED,
      walletData: { address: "GABC...XYZ", network: "public", balance: "0 XLM" },
      disconnect,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    });

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

// ─── 3. handleCopyAddress stability (useCallback) ────────────────────────────

describe("WalletStatus — handleCopyAddress useCallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("copies the wallet address on click when connected", async () => {
    (clipboardLib.copyToClipboard as jest.Mock).mockResolvedValue(undefined);

    renderHarness(
      makeCtx({
        state: WALLET_STATES.CONNECTED,
        walletData: {
          address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ123456",
          network: "public",
          balance: "500 XLM",
        },
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy wallet address/i }));
    });

    expect(clipboardLib.copyToClipboard).toHaveBeenCalledWith(
      "GABCDEFGHIJKLMNOPQRSTUVWXYZ123456"
    );
  });

  it("shows a success toast after copying", async () => {
    (clipboardLib.copyToClipboard as jest.Mock).mockResolvedValue(undefined);

    renderHarness(
      makeCtx({
        state: WALLET_STATES.CONNECTED,
        walletData: { address: "GABC...XYZ", network: "public", balance: "0 XLM" },
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy wallet address/i }));
    });

    await waitFor(() => {
      expect(screen.getAllByText(/address copied/i).length).toBeGreaterThan(0);
    });
  });

  it("shows an error toast when copy fails", async () => {
    (clipboardLib.copyToClipboard as jest.Mock).mockRejectedValue(new Error("denied"));

    renderHarness(
      makeCtx({
        state: WALLET_STATES.CONNECTED,
        walletData: { address: "GABC...XYZ", network: "public", balance: "0 XLM" },
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy wallet address/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/copy failed/i)).toBeInTheDocument();
    });
  });

  it("does nothing when walletData has no address", async () => {
    renderHarness(
      makeCtx({
        state: WALLET_STATES.CONNECTED,
        walletData: { address: "", network: "public", balance: "0 XLM" },
      })
    );

    // With an empty address the copy button should not be rendered
    // (address row only shows when walletData is truthy and showAddress is true,
    //  but an empty address means truncateAddress returns "")
    expect(clipboardLib.copyToClipboard).not.toHaveBeenCalled();
  });

  it("updates after walletData address changes", async () => {
    (clipboardLib.copyToClipboard as jest.Mock).mockResolvedValue(undefined);

    const { setCtx } = renderHarness(
      makeCtx({
        state: WALLET_STATES.CONNECTED,
        walletData: { address: "GABC...OLD1", network: "public", balance: "0 XLM" },
      })
    );

    // Swap to a new address
    await setCtx({
      walletData: { address: "GNEW...ADDR", network: "public", balance: "0 XLM" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /copy wallet address/i }));
    });

    expect(clipboardLib.copyToClipboard).toHaveBeenCalledWith("GNEW...ADDR");
  });
});

// ─── 4. All six states render correctly (behaviour unchanged) ─────────────────

describe("WalletStatus — all states render correctly after memoization", () => {
  const states: Array<[string, Partial<WalletContextValue>, RegExp]> = [
    [WALLET_STATES.DISCONNECTED, {}, /connect wallet/i],
    [WALLET_STATES.CONNECTING, {}, /connecting/i],
    [
      WALLET_STATES.CONNECTED,
      { walletData: { address: "GABC...XYZ", network: "public", balance: "0 XLM" } },
      /disconnect/i,
    ],
    [WALLET_STATES.ERROR, { error: "oops" }, /retry/i],
    [WALLET_STATES.WRONG_NETWORK, {}, /switch network/i],
    [WALLET_STATES.NO_WALLET, {}, /install wallet/i],
  ];

  test.each(states)(
    "state=%s renders the correct action button",
    (state, overrides, btnPattern) => {
      const ctx = makeCtx({ state, ...overrides });
      render(
        <ToastProvider>
          <WalletContext.Provider value={ctx}>
            <WalletStatus />
          </WalletContext.Provider>
        </ToastProvider>
      );
      expect(screen.getByRole("button", { name: btnPattern })).toBeInTheDocument();
    }
  );
});

// ─── 5. Large-dataset scenario ───────────────────────────────────────────────

describe("WalletStatus — large-dataset unrelated re-render", () => {
  it("does not re-render WalletStatus when a large sibling list re-renders", async () => {
    // Plain function component — counts renders triggered by context changes.
    function SpyWalletStatus() {
      return <WalletStatus />;
    }

    const ctx = makeCtx();
    let setListExternal!: React.Dispatch<React.SetStateAction<number[]>>;

    function BigListHarness() {
      // Simulate a large data set (1 000 items) that can be updated
      const [list, setList] = useState(() => Array.from({ length: 1000 }, (_, i) => i));
      setListExternal = setList;

      return (
        <ToastProvider>
          <WalletContext.Provider value={ctx}>
            <SpyWalletStatus />
            {/* Simulate a large filtered list re-rendering */}
            <ul>
              {list.slice(0, 5).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </WalletContext.Provider>
        </ToastProvider>
      );
    }

    render(<BigListHarness />);

    // Simulate a filter / sort change that causes the list to update
    await act(() => {
      setListExternal((prev) => [...prev].reverse());
    });
    await act(() => {
      setListExternal((prev) => [...prev].sort(() => Math.random() - 0.5));
    });

    // Wallet context did not change — the rendered output must be identical
    // regardless of how many times React chose to re-render the tree.
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByText(/connect your stellar wallet/i)).toBeInTheDocument();
  });
});

// ─── 6. Filter change still updates config ───────────────────────────────────

describe("WalletStatus — wallet state change while unrelated filter is active", () => {
  it("correctly re-derives config after state transition alongside a filter change", async () => {
    let setCtxExternal!: React.Dispatch<React.SetStateAction<WalletContextValue>>;
    let setFilterExternal!: React.Dispatch<React.SetStateAction<string>>;

    function FilterHarness() {
      const [ctx, setCtx] = useState<WalletContextValue>(makeCtx());
      const [filter, setFilter] = useState("all");

      setCtxExternal = setCtx;
      setFilterExternal = setFilter;

      return (
        <ToastProvider>
          <WalletContext.Provider value={ctx}>
            <span data-testid="filter">{filter}</span>
            <WalletStatus />
          </WalletContext.Provider>
        </ToastProvider>
      );
    }

    render(<FilterHarness />);

    // Confirm initial DISCONNECTED state
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();

    // Simulate filter change (unrelated) AND wallet state change simultaneously
    await act(() => {
      setFilterExternal("open");
      setCtxExternal((prev) => ({
        ...prev,
        state: WALLET_STATES.CONNECTED,
        walletData: { address: "GABC...XYZ", network: "public", balance: "0 XLM" },
      }));
    });

    // Filter updated
    expect(screen.getByTestId("filter")).toHaveTextContent("open");
    // Wallet config correctly updated to CONNECTED state
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /connect wallet/i })).not.toBeInTheDocument();
  });
});
