/**
 * @jest-environment jsdom
 *
 * @file invoice-detail.memoize.test.tsx
 *
 * Verifies the memoization contract for invoice-detail rendering:
 *
 *   1. InvoiceDetailFieldRow — skips re-render when props are referentially /
 *      shallow-equal across unrelated parent state changes.
 *   2. FundDisclaimer / FundAmountSection — skip re-render when copy-link busy
 *      state flips (unrelated to those subtrees).
 *   3. TimelineStageRow — skips re-render when status/timestamps are unchanged.
 *   4. Filter/status change still updates — genuine prop changes re-render.
 *   5. Large data set — deriving + rendering many field rows stays correct.
 */

import React, { useMemo, useState } from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

import InvoiceDetailRows, { InvoiceDetailFieldRow } from "./InvoiceDetailRows";
import { FundActionButtons, FundAmountSection, FundDisclaimer } from "./FundActions";
import { deriveInvoiceDetailFields } from "./invoiceDetailModel";
import { TimelineStageRow, deriveTimelineStages } from "@/components/InvoiceTimeline";
import { copy } from "@/app/copy/en";

jest.mock(
  "@/components/StatusPill",
  () =>
    function StatusPillMock({ status }: { status: string }) {
      return (
        <span role="status" data-status={status}>
          {status}
        </span>
      );
    }
);

jest.mock("@/components/FundAmountInput", () => {
  const ReactActual = require("react");
  return {
    __esModule: true,
    default: function FundAmountInputMock(props: {
      maxAmount: number;
      currency: string;
      disabled?: boolean;
    }) {
      // Count renders via a data attribute so memoization tests can assert
      // that the amount section did not remount on unrelated parent updates.
      const renderCountRef = ReactActual.useRef(0);
      renderCountRef.current += 1;
      return (
        <div
          data-testid="fund-amount-input"
          data-render-count={renderCountRef.current}
          data-disabled={props.disabled ? "true" : "false"}
        >
          Fund up to {props.maxAmount} {props.currency}
        </div>
      );
    },
  };
});

jest.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

jest.mock("@/components/WalletContext", () => ({
  WALLET_STATES: {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    NO_WALLET: "no_wallet",
    WRONG_NETWORK: "wrong_network",
  },
  useWallet: () => ({ state: "disconnected", connect: jest.fn() }),
}));

const SAMPLE_INVOICE = {
  id: "inv-001",
  issuer: "Acme Supplies Ltd",
  amount: "12,500",
  amountValue: 12500,
  currency: "USD",
  dueDate: "2026-06-15",
  yield: "8.2",
  yieldValue: 8.2,
  status: "Open",
};

describe("InvoiceDetailFieldRow memoization", () => {
  it("does not re-render when props are unchanged across parent re-renders", () => {
    const renderSpy = jest.spyOn(InvoiceDetailFieldRow, "type");

    function Harness() {
      const [counter, setCounter] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setCounter((c) => c + 1)}>
            bump {counter}
          </button>
          <dl>
            <InvoiceDetailFieldRow label="Issuer" value="Acme" />
          </dl>
        </div>
      );
    }

    render(<Harness />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /bump/i }));
    fireEvent.click(screen.getByRole("button", { name: /bump/i }));

    expect(screen.getByText("bump 2")).toBeInTheDocument();
    expect(renderSpy).toHaveBeenCalledTimes(1);

    renderSpy.mockRestore();
  });

  it("re-renders when the value prop changes (filter/status still updates)", () => {
    const renderSpy = jest.spyOn(InvoiceDetailFieldRow, "type");

    const { rerender } = render(
      <dl>
        <InvoiceDetailFieldRow label="Status" value="Open" kind="status" />
      </dl>
    );
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Open");

    rerender(
      <dl>
        <InvoiceDetailFieldRow label="Status" value="Funded" kind="status" />
      </dl>
    );
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent("Funded");

    renderSpy.mockRestore();
  });
});

describe("InvoiceDetailRows + derived fields", () => {
  it("renders all derived fields and stays stable under unrelated parent state", () => {
    const fields = deriveInvoiceDetailFields(SAMPLE_INVOICE);
    const renderSpy = jest.spyOn(InvoiceDetailFieldRow, "type");

    function Harness() {
      const [counter, setCounter] = useState(0);
      // Stable fields reference across unrelated re-renders — mirrors a parent
      // that memoizes deriveInvoiceDetailFields on [invoice].
      const stableFields = useMemo(() => fields, []);
      return (
        <div>
          <button type="button" onClick={() => setCounter((c) => c + 1)}>
            bump {counter}
          </button>
          <InvoiceDetailRows fields={stableFields} />
        </div>
      );
    }

    render(<Harness />);
    const initialCalls = renderSpy.mock.calls.length;
    expect(initialCalls).toBe(5);
    expect(screen.getByText(SAMPLE_INVOICE.issuer)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /bump/i }));
    expect(renderSpy.mock.calls.length).toBe(initialCalls);

    renderSpy.mockRestore();
  });

  it("renders correctly for a large data set of field rows", () => {
    const largeFields = Array.from({ length: 200 }, (_, i) => ({
      key: `f-${i}`,
      label: `Label ${i}`,
      value: `Value ${i}`,
    }));

    render(<InvoiceDetailRows fields={largeFields} />);
    expect(screen.getByText("Label 0")).toBeInTheDocument();
    expect(screen.getByText("Value 199")).toBeInTheDocument();
    expect(screen.getAllByRole("term")).toHaveLength(200);
  });
});

describe("FundActions memoized subtrees", () => {
  it("does not re-render FundDisclaimer when copy busy state flips", () => {
    const renderSpy = jest.spyOn(FundDisclaimer, "type");

    function Harness() {
      const [isCopying, setIsCopying] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setIsCopying((v) => !v)}>
            toggle {isCopying ? "busy" : "idle"}
          </button>
          <FundActionButtons
            onFund={() => {}}
            onCopyLink={() => {}}
            onPrint={() => {}}
            isFundingDisabled={false}
            isCopying={isCopying}
          />
          <FundDisclaimer />
        </div>
      );
    }

    render(<Harness />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /toggle/i }));
    fireEvent.click(screen.getByRole("button", { name: /toggle/i }));

    expect(renderSpy).toHaveBeenCalledTimes(1);
    renderSpy.mockRestore();
  });

  it("does not re-render FundAmountSection when only isCopying changes", () => {
    const renderSpy = jest.spyOn(FundAmountSection, "type");
    const onSubmit = jest.fn();

    function Harness() {
      const [isCopying, setIsCopying] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setIsCopying((v) => !v)}>
            toggle-copy {String(isCopying)}
          </button>
          <FundAmountSection
            maxAmount={12500}
            currency="USD"
            yieldValue={8.2}
            onSubmit={onSubmit}
            disabled={false}
          />
          <FundActionButtons
            onFund={() => {}}
            onCopyLink={() => {}}
            onPrint={() => {}}
            isFundingDisabled={false}
            isCopying={isCopying}
          />
        </div>
      );
    }

    render(<Harness />);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("fund-amount-input")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /toggle-copy/i }));
    expect(renderSpy).toHaveBeenCalledTimes(1);

    renderSpy.mockRestore();
  });

  it("re-renders FundAmountSection when funding disabled flag changes", () => {
    const renderSpy = jest.spyOn(FundAmountSection, "type");

    const { rerender } = render(
      <FundAmountSection
        maxAmount={12500}
        currency="USD"
        yieldValue={8.2}
        onSubmit={() => {}}
        disabled={false}
      />
    );
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("fund-amount-input")).toHaveAttribute("data-disabled", "false");

    rerender(
      <FundAmountSection
        maxAmount={12500}
        currency="USD"
        yieldValue={8.2}
        onSubmit={() => {}}
        disabled={true}
      />
    );
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("fund-amount-input")).toHaveAttribute("data-disabled", "true");

    renderSpy.mockRestore();
  });
});

describe("TimelineStageRow memoization", () => {
  it("does not re-render stages when parent state is unrelated", () => {
    const stages = deriveTimelineStages("Open", { uploaded: "2025-01-10" });
    const renderSpy = jest.spyOn(TimelineStageRow, "type");

    function Harness() {
      const [counter, setCounter] = useState(0);
      const stableStages = useMemo(() => stages, []);
      return (
        <div>
          <button type="button" onClick={() => setCounter((c) => c + 1)}>
            bump {counter}
          </button>
          <ol>
            {stableStages.map((stage) => (
              <TimelineStageRow key={stage.stageKey} {...stage} />
            ))}
          </ol>
        </div>
      );
    }

    render(<Harness />);
    expect(renderSpy).toHaveBeenCalledTimes(5);

    fireEvent.click(screen.getByRole("button", { name: /bump/i }));
    expect(renderSpy).toHaveBeenCalledTimes(5);
    expect(screen.getByText(copy.invoiceTimeline.stageUploaded)).toBeInTheDocument();

    renderSpy.mockRestore();
  });

  it("re-derives and updates when status filter changes", () => {
    const openStages = deriveTimelineStages("Open");
    const fundedStages = deriveTimelineStages("Funded");

    const openCurrent = openStages.find((s) => s.stageState === "current");
    const fundedCurrent = fundedStages.find((s) => s.stageState === "current");

    expect(openCurrent?.stageKey).toBe("listed");
    expect(fundedCurrent?.stageKey).toBe("funded");

    function Harness({ status }: { status: string }) {
      const stages = useMemo(() => deriveTimelineStages(status), [status]);
      return (
        <ol>
          {stages.map((stage) => (
            <TimelineStageRow key={stage.stageKey} {...stage} />
          ))}
        </ol>
      );
    }

    const { rerender } = render(<Harness status="Open" />);
    expect(
      screen.getByLabelText(
        `${copy.invoiceTimeline.stageListed} — ${copy.invoiceTimeline.statusCurrent}`
      )
    ).toBeInTheDocument();

    rerender(<Harness status="Funded" />);
    expect(
      screen.getByLabelText(
        `${copy.invoiceTimeline.stageFunded} — ${copy.invoiceTimeline.statusCurrent}`
      )
    ).toBeInTheDocument();
  });
});

describe("unrelated large sibling list does not disturb detail rows", () => {
  it("keeps InvoiceDetailFieldRow render count stable beside a 1000-item list", () => {
    const fields = deriveInvoiceDetailFields(SAMPLE_INVOICE);
    const renderSpy = jest.spyOn(InvoiceDetailFieldRow, "type");

    function Harness() {
      const [items, setItems] = useState(() => Array.from({ length: 1000 }, (_, i) => i));
      const stableFields = useMemo(() => fields, []);
      return (
        <div>
          <button type="button" onClick={() => setItems((prev) => prev.map((n) => n + 1))}>
            reshuffle
          </button>
          <ul aria-label="large-set">
            {items.slice(0, 3).map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <InvoiceDetailRows fields={stableFields} />
        </div>
      );
    }

    render(<Harness />);
    const initial = renderSpy.mock.calls.length;
    expect(initial).toBe(5);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /reshuffle/i }));
    });

    expect(renderSpy.mock.calls.length).toBe(initial);
    renderSpy.mockRestore();
  });
});
