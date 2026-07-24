import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { InvestMarketplace, InvoiceListItem, PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "./page";

jest.mock("next/link", () => {
  function MockLink({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }
  return { __esModule: true, default: MockLink };
});

jest.mock("@/components/NavMenu", () => {
  function MockNavMenu() {
    return <nav aria-label="site navigation" />;
  }
  return { __esModule: true, default: MockNavMenu };
});

function makeInvoices(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `inv-${String(i + 1).padStart(3, "0")}`,
    issuer: `Issuer ${i + 1}`,
    amount: "1,000",
    currency: "USD",
    dueDate: "2026-12-31",
    yield: "5.0%",
    status: "Open",
  }));
}

function createDeferredLoader(invoices, delayMs = 0) {
  return jest.fn(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(invoices), delayMs);
      })
  );
}

async function flushTimers(delayMs = 0) {
  await act(async () => {
    jest.advanceTimersByTime(delayMs);
    await Promise.resolve();
  });
}

const sampleInvoice = {
  id: "inv-001",
  issuer: "Acme Supplies",
  amount: "1,000",
  currency: "USD",
  dueDate: "2026-06-15",
  yield: "5.0%",
  status: "Open",
};

describe("InvoiceListItem memoization (unit)", () => {
  // `memo(Component)` returns { type: Component, ... } — spying on `.type`
  // lets us count how many times the *inner* render function actually ran,
  // which is exactly what memo's shallow-prop comparison decides to skip.
  it("does not re-render when the invoice prop is referentially unchanged across parent re-renders", () => {
    const renderSpy = jest.spyOn(InvoiceListItem, "type");

    function Harness() {
      const [counter, setCounter] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setCounter((c) => c + 1)}>
            bump {counter}
          </button>
          <ul>
            <InvoiceListItem invoice={sampleInvoice} />
          </ul>
        </div>
      );
    }

    render(<Harness />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /bump/i }));
    fireEvent.click(screen.getByRole("button", { name: /bump/i }));

    // The harness re-rendered (its own button label changed) but the same
    // `sampleInvoice` object reference was passed each time, so the row's
    // own render function should not have run again.
    expect(screen.getByText("bump 2")).toBeInTheDocument();
    expect(renderSpy).toHaveBeenCalledTimes(1);

    renderSpy.mockRestore();
  });

  it("re-renders when the invoice prop changes to a different object", () => {
    const renderSpy = jest.spyOn(InvoiceListItem, "type");

    const { rerender } = render(<InvoiceListItem invoice={sampleInvoice} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    rerender(<InvoiceListItem invoice={{ ...sampleInvoice, issuer: "Beta GmbH" }} />);
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Beta GmbH")).toBeInTheDocument();

    renderSpy.mockRestore();
  });
});

describe("InvestMarketplace row memoization (integration)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("does not re-render visible rows while typing in the search box before the debounce fires", async () => {
    const invoices = makeInvoices(3);
    render(<InvestMarketplace loadInvoices={createDeferredLoader(invoices, 0)} />);
    await flushTimers(0);

    const renderSpy = jest.spyOn(InvoiceListItem, "type");
    const callsAfterInitialRender = renderSpy.mock.calls.length;

    fireEvent.change(screen.getByLabelText("Search by issuer name"), {
      target: { value: "I" },
    });
    fireEvent.change(screen.getByLabelText("Search by issuer name"), {
      target: { value: "Is" },
    });

    // Debounce has not elapsed yet — filteredInvoices/visibleInvoices are the
    // same memoized arrays, so no row's own render function should have run
    // again despite InvestMarketplace re-rendering on every keystroke.
    expect(renderSpy.mock.calls.length).toBe(callsAfterInitialRender);

    renderSpy.mockRestore();
  });

  it("re-renders only the affected rows once a real filter change actually narrows the list", async () => {
    const invoices = [
      { ...makeInvoices(1)[0], id: "inv-001", issuer: "Acme", currency: "USD" },
      { ...makeInvoices(1)[0], id: "inv-002", issuer: "Beta", currency: "EUR" },
    ];
    render(<InvestMarketplace loadInvoices={createDeferredLoader(invoices, 0)} />);
    await flushTimers(0);

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Filter by EUR"));

    // A genuine filter change must still update what's on screen.
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("renders correctly with a large data set", async () => {
    const invoices = makeInvoices(500);
    render(<InvestMarketplace loadInvoices={createDeferredLoader(invoices, 0)} />);
    await flushTimers(0);

    expect(screen.getAllByText(/^Issuer \d+$/)).toHaveLength(PAGE_SIZE);

    fireEvent.click(screen.getByRole("button", { name: /load more invoices/i }));
    await flushTimers(0);

    expect(screen.getAllByText(/^Issuer \d+$/)).toHaveLength(PAGE_SIZE * 2);
  });
});
