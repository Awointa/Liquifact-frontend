"use client";

import { useMemo } from "react";
import EmptyState, { InvoiceEmptyIllustration } from "./EmptyState";
import { copy } from "../app/copy/en";

const INVOICE_STATUSES = {
  PENDING_TOKENIZATION: "Pending tokenization",
  TOKENIZED: "Tokenized",
  FUNDED: "Funded",
  SETTLED: "Settled",
};

const STATUS_STYLES = {
  [INVOICE_STATUSES.PENDING_TOKENIZATION]:
    "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20",
  [INVOICE_STATUSES.TOKENIZED]: "bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-400/20",
  [INVOICE_STATUSES.FUNDED]: "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20",
  [INVOICE_STATUSES.SETTLED]: "bg-slate-800/80 text-slate-200 ring-1 ring-slate-500/20",
};

function mergeInvoices(optimisticInvoices, loadedInvoices) {
  const mergedById = new Map();
  (optimisticInvoices ?? []).forEach((invoice) => mergedById.set(invoice.id, invoice));
  (loadedInvoices ?? []).forEach((invoice) => {
    if (!mergedById.has(invoice.id)) mergedById.set(invoice.id, invoice);
  });
  return Array.from(mergedById.values());
}

export function getMaturityBadgeProps(days) {
  if (days < 0) {
    const abs = Math.abs(days);
    return {
      label: `Overdue by ${abs} day${abs === 1 ? "" : "s"}`,
      className: "bg-red-500/10 text-red-200 ring-1 ring-red-400/20",
    };
  }
  if (days === 0) {
    return {
      label: "Matures today",
      className: "bg-yellow-500/10 text-yellow-200 ring-1 ring-yellow-400/20",
    };
  }
  return {
    label: `Matures in ${days} day${days === 1 ? "" : "s"}`,
    className: "bg-slate-500/10 text-slate-200 ring-1 ring-slate-400/20",
  };
}

export default function InvoiceList({ invoices = [], optimisticInvoices = [] }) {
  const mergedInvoices = useMemo(
    () => mergeInvoices(optimisticInvoices, invoices),
    [optimisticInvoices, invoices]
  );

  return (
    <section aria-labelledby="invoice-list-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="invoice-list-heading" className="text-xl font-semibold text-slate-100">
            Your invoices
          </h2>
          <p className="text-sm text-slate-400">
            Track tokenization progress for uploaded documents.
          </p>
        </div>
      </div>

      {mergedInvoices.length === 0 ? (
        <EmptyState
          icon={<InvoiceEmptyIllustration />}
          title="No invoices yet"
          description={copy.invoices.emptyState || "Upload your first invoice to get started."}
          action={
            <a
              href="#invoice-upload-btn"
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-700 bg-cyan-900/30 px-5 py-2.5 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-800/40 focus-ring"
            >
              Upload your first invoice
            </a>
          }
        />
      ) : (
        <ul className="space-y-4">
          {mergedInvoices.map((invoice) => {
            const statusValue =
              invoice.status in STATUS_STYLES
                ? invoice.status
                : INVOICE_STATUSES.PENDING_TOKENIZATION;
            return (
              <li key={invoice.id} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Invoice</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">{invoice.issuer}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${STATUS_STYLES[statusValue]}`}>
                    {statusValue}
                  </span>
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Amount</dt>
                    <dd className="mt-2 text-sm text-slate-200">{invoice.currency} {invoice.amount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Estimated yield</dt>
                    <dd className="mt-2 text-sm text-slate-200">{invoice.yield}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Due date</dt>
                    <dd className="mt-2 text-sm text-slate-200">{invoice.dueDate}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Reference</dt>
                    <dd className="mt-2 text-sm text-slate-200">{invoice.id}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
