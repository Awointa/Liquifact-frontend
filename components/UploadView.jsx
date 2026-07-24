"use client";

import { useEffect, useMemo, useState } from "react";
import UploadZone from "./UploadZone";
import InvoiceList from "./InvoiceList";
import ErrorBanner from "./ErrorBanner";
import InvoiceListSkeleton from "./InvoiceListSkeleton";
import { copy } from "../app/copy/en";

/**
 * UploadView Component
 * Orchestrates the invoice upload experience by managing the fetch-state model
 * for existing invoices while providing the UploadZone for new submissions.
 */
export default function UploadView({ loadInvoices }) {
  const [invoices, setInvoices] = useState(null); // null = loading
  const [loadError, setLoadError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [optimisticInvoices, setOptimisticInvoices] = useState([]);

  const reload = () => {
    setInvoices(null);
    setLoadError("");
    setRetryKey((k) => k + 1);
  };

  const handleUploadSuccess = (invoice) => {
    setOptimisticInvoices((current) => [invoice, ...current]);
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    async function load() {
      setInvoices(null);
      setLoadError("");

      try {
        const result = await loadInvoices({ signal: controller.signal });
        if (!isActive) return;

        const normalized = Array.isArray(result) ? result : [];
        setInvoices(normalized);
      } catch (error) {
        if (!isActive || error.name === "AbortError") return;
        setLoadError(copy.invoices.errorDescription || "Unable to load invoices.");
        setInvoices([]);
      }
    }

    load();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [loadInvoices, retryKey]);

  const statusMessage = useMemo(() => {
    if (loadError) return copy.invoices.errorStatus || "Unable to load invoices.";
    if (invoices === null) return "Loading invoices...";
    
    const totalCount = (invoices?.length || 0) + optimisticInvoices.length;
    if (totalCount === 0) return copy.invoices.emptyState || "No invoices yet.";
    
    return `${totalCount} invoice${totalCount === 1 ? "" : "s"} available.`;
  }, [invoices, loadError, optimisticInvoices]);

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      {/* Polite live region – announced to screen readers on every state change */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMessage}
      </div>

      <div className="lg:col-span-1">
        <UploadZone onUploadSuccess={handleUploadSuccess} />
      </div>

      <div className="lg:col-span-2">
        {loadError ? (
          <div className="space-y-6">
            <ErrorBanner
              variant="error"
              title={copy.invoices.errorTitle || "Unable to load invoices"}
              description={loadError}
              actionLabel={copy.invest.retryAction || "Try again"}
              onAction={reload}
              previewLabel="Upload view status"
            />
          </div>
        ) : invoices === null && optimisticInvoices.length === 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-100">Your invoices</h2>
            <InvoiceListSkeleton rows={3} />
          </div>
        ) : (
          <InvoiceList 
            invoices={invoices || []} 
            optimisticInvoices={optimisticInvoices} 
          />
        )}
      </div>
    </div>
  );
}
