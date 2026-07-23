/**
 * @file components/InvoiceCard.jsx
 * Renders a single invoice row for the Invest marketplace.
 * This is the canonical card markup; InvoiceListSkeleton mirrors its layout.
 *
 * Status is rendered via the shared `StatusPill` component so that label,
 * tone, and a11y metadata stay in one place.  See `lib/types/invoice.js`
 * and `components/StatusPill.jsx`.
 *
 * The card optionally displays a star (watchlist) toggle button when
 * `onToggleWatch` and `isWatched` are provided.  The toggle button uses
 * `aria-pressed` to communicate its state and includes the invoice
 * reference in its accessible name.
 */

import Link from "next/link";
import StatusPill from "@/components/StatusPill";
import { formatAmount, formatCurrency, INVALID_VALUE_FALLBACK } from "@/lib/format/currency";
import { resolveStatusPill } from "@/lib/types/invoice";

/** @typedef {import("@/lib/types/invoice").Invoice} Invoice */

/**
 * Formats a date string into a human-readable short date.
 * Falls back gracefully when the value is missing or unparseable.
 * @param {string|undefined} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Star icon SVG — filled variant.
 * @param {object} props
 * @param {string} [props.className]
 */
function StarFilledIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/**
 * Star icon SVG — outline variant.
 * @param {object} props
 * @param {string} [props.className]
 */
function StarOutlineIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/**
 * @param {object}     props
 * @param {Invoice}    props.invoice
 * @param {boolean}    [props.isWatched]
 * @param {Function}   [props.onToggleWatch] - Called with the invoice ID when the star is clicked.
 */
export default function InvoiceCard({ invoice, isWatched = false, onToggleWatch }) {
  const { id, issuer, amount, currency, dueDate, yield: yieldPct, status } = invoice ?? {};

  // Resolve the canonical pill label once so the link aria-label and the
  // pill aria-label stay in lock-step (both read from the same source).
  const { label: statusLabel } = resolveStatusPill(status);
  const formattedYield = formatAmount(yieldPct);
  const yieldText =
    formattedYield === INVALID_VALUE_FALLBACK ? INVALID_VALUE_FALLBACK : `${formattedYield}%`;

  // Compose the link aria-label.  When the canonical status resolves to
  // "Unknown" (nullish / unrecognised input), drop the trailing " — <label>"
  // segment so the aria-label does not advertise a misleading status.
  const statusSuffix = statusLabel && statusLabel !== "Unknown" ? ` \u2014 ${statusLabel}` : "";

  const hasWatchToggle = typeof onToggleWatch === "function";
  const refForAria = id ?? "unknown";
  const starLabel = isWatched ? `Unstar invoice ${refForAria}` : `Star invoice ${refForAria}`;

  return (
    <div className="group relative flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-5 py-4 transition-colors hover:border-cyan-700/60 hover:bg-slate-900">
      {/* Star toggle — only rendered when onToggleWatch is provided */}
      {hasWatchToggle && (
        <button
          type="button"
          onClick={() => onToggleWatch(id)}
          aria-pressed={isWatched}
          aria-label={starLabel}
          className={[
            "flex-shrink-0 mt-0.5 rounded p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950",
            isWatched
              ? "text-amber-400 hover:text-amber-300"
              : "text-slate-600 hover:text-slate-400",
          ].join(" ")}
        >
          {isWatched ? <StarFilledIcon /> : <StarOutlineIcon />}
        </button>
      )}

      {/* Card link — grows to fill remaining space */}
      <Link
        href={`/invest/${id}`}
        className="flex-1 min-w-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded-lg"
        aria-label={`Invoice ${id ?? ""} from ${issuer ?? "unknown issuer"}${statusSuffix}`}
      >
        {/* Row layout: mirrors InvoiceListSkeleton column widths */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {/* Issuer — w-1/4 min */}
          <div className="min-w-0 flex-1 basis-1/4">
            <p className="truncate font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors">
              {issuer ?? <span className="text-slate-500 italic">Unknown issuer</span>}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{id ?? "\u2014"}</p>
          </div>

          {/* Amount — w-1/5 */}
          <div className="basis-1/5 text-right">
            <p className="font-mono text-slate-200">{formatCurrency(amount, { currency })}</p>
            <p className="text-xs text-slate-500 mt-0.5">Amount</p>
          </div>

          {/* Yield — w-1/6 */}
          <div className="basis-1/6 text-right">
            <p className="font-mono text-cyan-400">{yieldText}</p>
            <p className="text-xs text-slate-500 mt-0.5">Yield</p>
          </div>

          {/* Maturity — w-1/5 */}
          <div className="basis-1/5 text-right">
            <p className="text-slate-300">{formatDate(dueDate)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Maturity</p>
          </div>

          {/* Status pill — w-auto (rendered via shared <StatusPill>) */}
          <div className="basis-auto">
            <StatusPill status={status ?? ""} />
          </div>
        </div>
      </Link>
    </div>
  );
}
