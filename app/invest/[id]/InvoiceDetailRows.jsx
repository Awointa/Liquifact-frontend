"use client";

/**
 * @file InvoiceDetailRows.jsx
 *
 * Memoized metadata field rows for the invoice detail summary.
 *
 * Extracted so that when a parent client tree re-renders for an unrelated
 * reason (e.g. a sibling counter, a filter toggle, or copy-link busy state),
 * each field row skips reconciliation unless its own `label`/`value`/`kind`
 * props actually changed.
 */

import { memo, useMemo } from "react";
import StatusPill from "@/components/StatusPill";

/**
 * A single `<dt>`/`<dd>` pair in the invoice summary definition list.
 * Wrapped in `memo` so shallow-equal props short-circuit the render.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {string} [props.kind] - When `"status"`, value is rendered via StatusPill
 */
export const InvoiceDetailFieldRow = memo(function InvoiceDetailFieldRow({ label, value, kind }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-100">
        {kind === "status" ? <StatusPill status={value ?? ""} /> : value}
      </dd>
    </div>
  );
});

/**
 * Renders the memoized field-row list for an invoice detail summary.
 *
 * The `fields` array itself is memoized against the incoming reference so
 * mapping work is skipped when the parent re-renders with the same derived
 * descriptors (the common case after `deriveInvoiceDetailFields` + `useMemo`
 * in a parent harness, or a stable prop from the RSC shell).
 *
 * @param {object} props
 * @param {Array<{ key: string, label: string, value: string, kind?: string }>} props.fields
 */
export default function InvoiceDetailRows({ fields }) {
  const rows = useMemo(
    () =>
      (fields ?? []).map((field) => (
        <InvoiceDetailFieldRow
          key={field.key}
          label={field.label}
          value={field.value}
          kind={field.kind}
        />
      )),
    [fields]
  );

  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">{rows}</dl>;
}
