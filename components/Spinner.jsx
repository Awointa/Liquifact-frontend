"use client";

/**
 * Spinner — shared loading indicator component.
 *
 * Renders an accessible animated SVG spinner.  `aria-hidden="true"` ensures
 * screen readers rely on the parent button's `aria-busy` attribute instead
 * of announcing the spinner graphic directly.
 *
 * Replaces inline SVG spinners previously defined in:
 *   - components/WalletStatus.jsx
 *   - components/UploadZone.jsx
 *
 * @param {Object}  props
 * @param {string}  [props.className="h-4 w-4"] — Tailwind sizing classes.
 * @param {Object}  [props...] — Additional attributes forwarded to the `<svg>` element.
 */
export default function Spinner({ className = "h-4 w-4", ...props }) {
  return (
    <svg
      className={`animate-spin inline ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
