import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import InvoiceList from "./InvoiceList";

describe("InvoiceList", () => {
  it("renders invoices and status badges on successful load", () => {
    const invoices = [
      {
        id: "inv-1001",
        issuer: "Test Supplier",
        amount: "12,500",
        currency: "USD",
        dueDate: "2026-06-15",
        yield: "8.2%",
        status: "Tokenized",
      },
      {
        id: "inv-1002",
        issuer: "Another LLC",
        amount: "7,800",
        currency: "EUR",
        dueDate: "2026-07-01",
        yield: "7.5%",
        status: "Settled",
      },
    ];

    render(<InvoiceList invoices={invoices} />);

    expect(screen.getByRole("heading", { name: /your invoices/i })).toBeInTheDocument();
    expect(screen.getByText("Test Supplier")).toBeInTheDocument();
    expect(screen.getByText("Another LLC")).toBeInTheDocument();
    expect(screen.getByText("Tokenized")).toBeInTheDocument();
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });

  it("renders empty state when no invoices are provided", () => {
    render(<InvoiceList invoices={[]} />);

    expect(screen.getByText(/No invoices yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload your first invoice/i)).toBeInTheDocument();
  });

  it("optimistically appends a new invoice when optimisticInvoices changes", () => {
    const invoices = [
      {
        id: "inv-003",
        issuer: "Stable Cargo",
        amount: "9,000",
        currency: "USD",
        dueDate: "2026-09-20",
        yield: "4.5%",
        status: "Funded",
      },
    ];

    const { rerender } = render(<InvoiceList invoices={invoices} optimisticInvoices={[]} />);

    expect(screen.getByText("Stable Cargo")).toBeInTheDocument();

    rerender(
      <InvoiceList
        invoices={invoices}
        optimisticInvoices={[
          {
            id: "upload-123",
            issuer: "New Upload.pdf",
            amount: "Pending",
            currency: "USD",
            dueDate: "Pending",
            yield: "Pending",
            status: "Pending tokenization",
          },
        ]}
      />
    );

    expect(screen.getByText("New Upload.pdf")).toBeInTheDocument();
    expect(screen.getByText("Pending tokenization")).toBeInTheDocument();
  });
});
