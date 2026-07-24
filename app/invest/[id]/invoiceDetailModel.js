/**
 * @file invoiceDetailModel.js
 *
 * Pure derivation helpers for the invoice detail view.
 *
 * Keeping formatting and field-row construction outside the React tree means
 * the same output is produced whether the caller is the RSC shell or a
 * memoized client harness — and makes the derivation unit-testable without
 * mounting the page.
 */

import { INVALID_VALUE_FALLBACK, formatCurrency, formatAmount } from "@/lib/format/currency";
import { copy } from "@/app/copy/en";

const detail = copy.invest.detail;

/**
 * Format a yield value as a percentage string.
 * Falls back to `INVALID_VALUE_FALLBACK` for unresolvable values.
 *
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
export function formatYield(value) {
  const formatted = formatAmount(value);
  return formatted === INVALID_VALUE_FALLBACK ? formatted : `${formatted}%`;
}

/**
 * Sanitize a plain-text value for safe use in JSON-LD.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .replace(/[<>{}"']/g, "");
}

/**
 * Build a JSON-LD `Offer` object for the invoice.
 * Returns `null` when invoice is absent.
 *
 * @param {object|null} invoice
 * @returns {object|null}
 */
export function buildInvoiceJsonLd(invoice) {
  if (!invoice) return null;

  const issuer = sanitizeText(invoice.issuer);
  const amount = sanitizeText(invoice.amount);
  const currency = sanitizeText(invoice.currency);
  const dueDate = sanitizeText(invoice.dueDate);
  const yieldValue = sanitizeText(invoice.yield);
  const status = sanitizeText(invoice.status);

  const descriptionParts = [
    issuer ? `Invoice offering from ${issuer}` : "Invoice offering",
    amount ? `Amount ${amount}` : null,
    currency ? `Currency ${currency}` : null,
    dueDate ? `Maturity ${dueDate}` : null,
    yieldValue ? `Estimated yield ${yieldValue}` : null,
    status ? `Status ${status}` : null,
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: issuer ? `Invoice offering from ${issuer}` : "Invoice offering",
    description: descriptionParts.join(". "),
    seller: issuer ? { "@type": "Organization", name: issuer } : undefined,
    price: amount || undefined,
    priceCurrency: currency || undefined,
    availability: status === "Open" ? "https://schema.org/InStock" : undefined,
    validFrom: dueDate || undefined,
  };
}

/**
 * Derive the ordered metadata field rows for the invoice summary `<dl>`.
 *
 * Each row is a plain descriptor (`key`, `label`, `value`, optional `kind`)
 * so a memoized row component can shallow-compare props and skip re-renders
 * when an unrelated parent state change leaves the descriptors unchanged.
 *
 * @param {object|null|undefined} invoice
 * @returns {Array<{ key: string, label: string, value: string, kind?: string }>}
 */
export function deriveInvoiceDetailFields(invoice) {
  if (!invoice) return [];

  return [
    {
      key: "issuer",
      label: detail.labelIssuer,
      value: invoice.issuer ?? "",
    },
    {
      key: "amount",
      label: detail.labelAmount,
      value: formatCurrency(invoice.amount, { currency: invoice.currency }),
    },
    {
      key: "yield",
      label: detail.labelYield,
      value: formatYield(invoice.yield),
    },
    {
      key: "maturity",
      label: detail.labelMaturity,
      value: invoice.dueDate ?? "",
    },
    {
      key: "status",
      label: detail.labelStatus,
      value: invoice.status ?? "",
      kind: "status",
    },
  ];
}

/**
 * Build the full derived view-model for the invoice detail page.
 *
 * @param {object} invoice
 * @returns {{
 *   fields: ReturnType<typeof deriveInvoiceDetailFields>,
 *   jsonLd: ReturnType<typeof buildInvoiceJsonLd>,
 *   issuer: string,
 *   id: string,
 *   status: string,
 *   maxAmount: number|undefined,
 *   currency: string|undefined,
 *   yieldValue: number|undefined,
 *   timestamps: object|undefined,
 * }}
 */
export function deriveInvoiceDetailViewModel(invoice) {
  return {
    fields: deriveInvoiceDetailFields(invoice),
    jsonLd: buildInvoiceJsonLd(invoice),
    issuer: invoice.issuer ?? "",
    id: invoice.id,
    status: invoice.status,
    maxAmount: invoice.amountValue,
    currency: invoice.currency,
    yieldValue: invoice.yieldValue,
    timestamps: invoice.timestamps,
  };
}
