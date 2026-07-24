"use client";

import { forwardRef } from "react";
import Spinner from "./Spinner";

/**
 * @typedef {'primary' | 'secondary' | 'warning' | 'external' | 'danger'} ButtonVariant
 *
 * Visual variants for the shared Button component:
 *   - `primary`   — Cyan accent, used for main CTAs (e.g. Connect Wallet,
 *                   Upload Invoice, Check API Health).
 *   - `secondary` — Neutral slate, used for secondary actions (e.g. Disconnect,
 *                   Clear Filters, Load More).
 *   - `warning`   — Amber accent, used for cautionary actions (e.g. Switch
 *                   Network).
 *   - `external`  — Violet accent, used for external links/actions (e.g. Install
 *                   Wallet Extension).
 *   - `danger`    — Red accent, used for destructive actions.
 */

/**
 * Shared Button component — unifies all button markup across the Liquifact
 * frontend.
 *
 * Replaces copy-pasted `<button>` elements in:
 *   - `app/page.js`            — API health check button
 *   - `app/invest/page.js`     — Load-more pagination button
 *   - `components/UploadZone.jsx` — Submit + reset buttons
 *   - `components/WalletStatus.jsx` — Connect/disconnect action button
 *   - `components/ErrorBanner.jsx`  — Retry action button
 *   - `components/InvoiceFilters.jsx` — Clear/clear-all buttons
 *
 * All variants share one consistent focus-visible outline (driven by the
 * `.focus-ring` utility class in `globals.css`), replacing the divergent
 * `focus:ring` vs `focus-visible:outline` styles that previously existed.
 *
 * @param {Object}  props
 * @param {ButtonVariant} [props.variant="primary"] — Visual style.
 * @param {boolean} [props.loading=false] — When `true`, renders a {@link Spinner}
 *   and sets `aria-busy="true"` on the button element.  The button is also
 *   disabled while loading.
 * @param {boolean} [props.disabled=false] — When `true`, disables interaction
 *   and applies reduced-opacity styles.
 * @param {string}  [props.className=""] — Additional Tailwind classes appended
 *   to the resolved class list.
 * @param {React.ReactNode} [props.children] — Button content.
 * @param {React.Ref<HTMLButtonElement>} ref — Forwarded ref for imperative
 *   focus management (e.g. `ref.current?.focus()`).
 */
const Button = forwardRef(function Button(
  {
    variant = "primary",
    loading = false,
    disabled = false,
    children,
    className = "",
    ...rest
  },
  ref
) {
  /** A button is non-interactive when either explicitly disabled or in a loading state. */
  const isDisabled = disabled || loading;

  /**
   * Base styles shared by every variant.
   * The `.focus-ring` utility provides a single, theme-aware, high-contrast
   * focus-visible outline (2px solid, 2px offset, rounded) — see
   * `app/globals.css` for the underlying CSS custom property.
   */
  const baseStyles = [
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5",
    "text-sm font-medium transition-all duration-200",
    "focus-ring",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" ");

  /** Per-variant colour schemes. */
  const variantStyles = {
    primary: "bg-cyan-500 text-slate-950 hover:bg-cyan-400 active:bg-cyan-500",
    secondary: "bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 active:bg-slate-600",
    warning: "bg-amber-500 text-slate-950 hover:bg-amber-400 active:bg-amber-500",
    external: "bg-violet-500 text-white hover:bg-violet-400 active:bg-violet-500",
    danger: "bg-red-500 text-white hover:bg-red-400 active:bg-red-500",
  };

  const combinedClassName = [
    baseStyles,
    variantStyles[variant] ?? variantStyles.primary,
    isDisabled ? "opacity-50 cursor-not-allowed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type="button"
      disabled={isDisabled}
      aria-busy={loading}
      className={combinedClassName}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
});

Button.displayName = "Button";

export default Button;
