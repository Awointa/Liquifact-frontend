"use client";

/**
 * @file FundActions.jsx
 *
 * Client-only interactive controls for the invoice detail page.
 *
 * This is the **only** file under `app/invest/[id]/` that carries a
 * `"use client"` directive for wallet / clipboard / print interactions.  It
 * owns:
 *   - Fund invoice button (wallet-state-aware)
 *   - Copy link button (Clipboard API + textarea fallback)
 *   - Print / Save PDF button
 *   - Disclaimer note
 *
 * Memoization contract
 * ────────────────────
 * Local `isCopying` state and wallet-context updates used to re-render the
 * entire action tree (including `FundAmountInput`) on every change.  The
 * expensive pieces are now isolated:
 *   - `isFundingDisabled` is derived via `useMemo`
 *   - All event handlers are stable via `useCallback`
 *   - Action buttons and the disclaimer are `memo`'d so a busy copy-link
 *     state does not re-render siblings whose props are unchanged
 *   - `FundAmountSection` is `memo`'d so typing unrelated UI state does not
 *     remount the amount input
 */

import { memo, useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { useWallet, WALLET_STATES } from "@/components/WalletContext";
import FundAmountInput from "@/components/FundAmountInput";
import { copy } from "@/app/copy/en";

const detail = copy.invest.detail;

// ── Clipboard helpers ─────────────────────────────────────────────────────────

/**
 * Textarea-based clipboard fallback for browsers without the async
 * Clipboard API (non-HTTPS contexts, older Safari, etc.).
 *
 * @param {string} text
 */
export function copyToClipboardFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch {
    // execCommand may be unsupported or blocked; degrade gracefully rather
    // than surfacing an error — the textarea is still cleaned up below.
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * Copy the canonical detail-page URL to the clipboard.
 *
 * @param {string} id - Invoice id
 * @returns {Promise<string>} The URL that was copied
 */
export async function copyInvoiceUrl(id) {
  const url = `${window.location.origin}/invest/${id}`;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  } else {
    copyToClipboardFallback(url);
  }
  return url;
}

// ── Memoized subtrees ─────────────────────────────────────────────────────────

/**
 * Partial-funding amount input section. Memoized so copy-link / print state
 * changes in the parent do not re-render the controlled input tree.
 */
export const FundAmountSection = memo(function FundAmountSection({
  maxAmount,
  currency,
  yieldValue,
  onSubmit,
  disabled,
}) {
  return (
    <div className="no-print mb-6">
      <FundAmountInput
        maxAmount={maxAmount}
        currency={currency ?? "USD"}
        yieldValue={yieldValue ?? 0}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    </div>
  );
});

/**
 * Fund / Copy link / Print action button row.
 */
export const FundActionButtons = memo(function FundActionButtons({
  onFund,
  onCopyLink,
  onPrint,
  isFundingDisabled,
  isCopying,
}) {
  return (
    <div className="no-print flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onFund}
        disabled={isFundingDisabled}
        className="rounded-full bg-cyan-500/20 text-cyan-400 px-6 py-3 text-sm font-medium hover:bg-cyan-500/30 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={detail.fundButtonLabel}
      >
        {detail.fundButton}
      </button>

      <button
        type="button"
        onClick={onCopyLink}
        disabled={isCopying}
        className="rounded-full border border-slate-700 text-slate-300 px-6 py-3 text-sm font-medium hover:bg-slate-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cyan-500 disabled:opacity-50"
        aria-label={detail.copyLinkButtonLabel}
      >
        {detail.copyLinkButton}
      </button>

      <button
        type="button"
        onClick={onPrint}
        className="rounded-full border border-slate-700 text-slate-300 px-6 py-3 text-sm font-medium hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-cyan-500"
        aria-label={detail.printButtonLabel}
      >
        {detail.printButton}
      </button>
    </div>
  );
});

/**
 * Static disclaimer note — never depends on interactive state.
 */
export const FundDisclaimer = memo(function FundDisclaimer() {
  return (
    <div className="no-print mt-6 rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
      {detail.disclaimerNote}
    </div>
  );
});

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Interactive fund / copy / print controls for an invoice.
 *
 * @param {object} props
 * @param {string} props.id          - Invoice id (used to build the share URL)
 * @param {string} props.status      - Invoice status; disables fund button when not "Open"
 * @param {number} [props.maxAmount]
 * @param {string} [props.currency]
 * @param {number} [props.yieldValue]
 */
export default function FundActions({ id, status, maxAmount, currency, yieldValue }) {
  const { state: walletState, connect } = useWallet();
  const toast = useToast();
  const [isCopying, setIsCopying] = useState(false);

  // Fund button is disabled while wallet is connecting or unavailable, or
  // if the invoice is not in an Open state.
  const isFundingDisabled = useMemo(
    () =>
      walletState === WALLET_STATES.CONNECTING ||
      walletState === WALLET_STATES.NO_WALLET ||
      status !== "Open",
    [walletState, status]
  );

  const handleFund = useCallback(() => {
    if (walletState === WALLET_STATES.DISCONNECTED) {
      connect();
    }
    // When already connected, a real funding flow (sign + submit TX) would
    // be triggered here. Placeholder until Stellar integration lands.
  }, [walletState, connect]);

  const handleCopyLink = useCallback(async () => {
    if (isCopying) return;
    setIsCopying(true);
    try {
      await copyInvoiceUrl(id);
      toast.success(detail.copySuccessMsg, detail.copySuccessTitle);
    } catch {
      toast.error(detail.copyErrorMsg, detail.copyErrorTitle);
    } finally {
      setIsCopying(false);
    }
  }, [id, isCopying, toast]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handlePrintKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePrint();
    }
  };

  // Partial-funding submit: prompt wallet connection when disconnected,
  // otherwise acknowledge the funding request. A real sign+submit flow
  // replaces the toast once the Stellar integration lands.
  const handleFundAmount = useCallback(
    (amount) => {
      if (walletState === WALLET_STATES.DISCONNECTED) {
        connect();
        return;
      }
      toast.success(
        `Funding request for ${amount} ${currency ?? ""} submitted. Awaiting wallet approval.`.trim(),
        "Funding submitted"
      );
    },
    [walletState, connect, toast, currency]
  );

  const showFundAmount = status === "Open" && maxAmount != null;

  return (
    <>
      {showFundAmount ? (
        <FundAmountSection
          maxAmount={maxAmount}
          currency={currency}
          yieldValue={yieldValue}
          onSubmit={handleFundAmount}
          disabled={isFundingDisabled}
        />
      ) : null}

      <FundActionButtons
        onFund={handleFund}
        onCopyLink={handleCopyLink}
        onPrint={handlePrint}
        isFundingDisabled={isFundingDisabled}
        isCopying={isCopying}
      />

      <FundDisclaimer />
    </>
  );
}
