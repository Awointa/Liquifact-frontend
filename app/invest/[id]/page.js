/**
 * @file app/invest/[id]/page.js
 *
 * Server Component shell for the invoice detail page.
 *
 * RSC split rationale
 * ───────────────────
 * The previous version was a single "use client" module, meaning every
 * formatting helper, copy string, and layout byte shipped to the browser on
 * the highest-intent route.  This file contains NO browser APIs and NO
 * React hooks — it runs entirely on the server, so headings, the metadata
 * table, and JSON-LD script are streamed as HTML and never appear in the JS
 * bundle.
 *
 * The only interactive piece — Fund / Copy link / Print buttons — is
 * delegated to the small `FundActions` client component which is the sole
 * "use client" boundary under this route segment for actions.  Metadata
 * field rows are rendered via the memoized `InvoiceDetailRows` client leaf
 * so unrelated client state changes (e.g. copy-link busy) cannot force those
 * rows to re-reconcile when their derived descriptors are unchanged.
 *
 * Data flow
 * ─────────
 * `params.id` → `getInvoiceById(id)` (sync, mock data for now)
 *             → `notFound()` if the id is unknown
 *             → `deriveInvoiceDetailViewModel(invoice)` for fields + JSON-LD
 *             → RSC renders layout + passes props to <FundActions>
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import NavMenu from "@/components/NavMenu";
import InvoiceTimeline from "@/components/InvoiceTimeline";
import { copy } from "@/app/copy/en";
import { getInvoiceById } from "../lib";
import FundActions from "./FundActions";
import InvoiceDetailRows from "./InvoiceDetailRows";
import { deriveInvoiceDetailViewModel } from "./invoiceDetailModel";

const detail = copy.invest.detail;

// Re-export pure helpers so existing tests that import from the page module
// (or that assert the derivation contract) keep a stable surface.
export {
  formatYield,
  sanitizeText,
  buildInvoiceJsonLd,
  deriveInvoiceDetailFields,
  deriveInvoiceDetailViewModel,
} from "./invoiceDetailModel";

/**
 * Page-level Server Component.
 *
 * Next.js App Router passes `{ params }` where `params.id` is the dynamic
 * segment.  We await params so the component is compatible with both the
 * current Next.js 14 sync form and the upcoming async-params API.
 *
 * @param {{ params: Promise<{ id: string }> | { id: string } }} props
 */
export default async function InvoiceDetailPage({ params }) {
  // Support both the current (sync object) and future (Promise) params shape.
  const { id } = await Promise.resolve(params);

  const invoice = getInvoiceById(id);

  if (!invoice) {
    notFound();
  }

  const viewModel = deriveInvoiceDetailViewModel(invoice);
  const { fields, jsonLd, issuer, status, maxAmount, currency, yieldValue, timestamps } = viewModel;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 print-page-wrapper">
      {/* ── Navigation ────────────────────────────────────────────────── */}
      <header className="no-print border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-block py-3 text-xl font-semibold tracking-tight text-cyan-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 rounded"
        >
          {detail.backToHome}
        </Link>
        {/* WalletStatus is a "use client" component — RSC can compose it */}
        <NavMenu />
      </header>

      <main id="main-content" className="max-w-4xl mx-auto px-6 py-12">
        {/* ── JSON-LD structured data ────────────────────────────────── */}
        {jsonLd ? (
          <script
            type="application/ld+json"
            // JSON.stringify is safe here; sanitizeText already stripped
            // characters that could escape the script context.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        ) : null}

        {/* ── Back navigation ───────────────────────────────────────── */}
        <Link
          href="/invest"
          className="no-print inline-block mb-6 text-sm text-slate-400 hover:text-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 rounded"
          aria-label={detail.backToMarketplaceLabel}
        >
          {detail.backToMarketplace}
        </Link>

        {/* ── Page heading ──────────────────────────────────────────── */}
        <h1 className="text-2xl font-bold mb-2">{detail.pageTitle}</h1>
        <p className="text-slate-400 mb-8">{detail.pageSub}</p>

        {/* ── Invoice metadata (memoized field rows) ────────────────── */}
        <section
          aria-labelledby="invoice-summary-heading"
          className="print-invoice-section rounded-xl border border-slate-800 bg-slate-900/50 p-6 mb-6"
        >
          <h2 id="invoice-summary-heading" className="text-xl font-semibold mb-4">
            {issuer}
          </h2>

          <InvoiceDetailRows fields={fields} />
        </section>

        {/* ── Lifecycle timeline (server-rendered, status-driven) ───────── */}
        <InvoiceTimeline status={status} timestamps={timestamps} className="mb-6" />

        {/* ── Interactive controls (client boundary) ────────────────── */}
        <FundActions
          id={invoice.id}
          status={status}
          maxAmount={maxAmount}
          currency={currency}
          yieldValue={yieldValue}
        />
      </main>
    </div>
  );
}
