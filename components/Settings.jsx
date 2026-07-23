"use client";

import ThemeToggle from "./ThemeToggle";

/**
 * Settings
 *
 * A user-preferences panel that surfaces application-level settings.
 * Currently exposes one control: the theme preference (light / dark /
 * system), delegated entirely to {@link ThemeToggle}.
 *
 * The panel renders as a `<section>` with an `aria-labelledby` heading so
 * assistive technologies announce the region as "Settings" when the user
 * navigates to it.  Each preference row pairs a visible `<label>` with its
 * control via `htmlFor` / `id`, satisfying WCAG 2.1 §1.3.1 (Info and
 * Relationships).
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 * @param {object}   [props]
 * @param {string}   [props.className='']       Extra Tailwind classes added to
 *                                              the root `<section>`.
 * @param {string}   [props.headingLevel='h2']  Heading element rendered for the
 *                                              "Settings" title.  Pass `'h3'`
 *                                              when the panel is nested inside
 *                                              another headed section.
 *                                              Accepts `'h1'`–`'h6'`.
 * @param {boolean}  [props.showHeading=true]   Set to `false` to render the
 *                                              heading visually hidden (it
 *                                              remains in the DOM for
 *                                              `aria-labelledby` so the section
 *                                              is still accessible).
 *
 * ─── Internal state ──────────────────────────────────────────────────────────
 * This component holds no local state.  All preference state (current theme,
 * persisted value) is managed inside `ThemeToggle` / `useLocalStorage`.
 */
export default function Settings({ className = "", headingLevel = "h2", showHeading = true }) {
  const Heading = VALID_HEADINGS.includes(headingLevel) ? headingLevel : "h2";

  return (
    <section
      aria-labelledby="settings-heading"
      data-testid="settings-panel"
      className={[
        "rounded-2xl border border-slate-800 bg-slate-900/60 p-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Heading — visually hidden when showHeading=false but always
          present so aria-labelledby resolves to a real element. */}
      <Heading
        id="settings-heading"
        className={[
          "text-base font-semibold text-slate-100",
          showHeading ? "" : "sr-only",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        Settings
      </Heading>

      {/* ── Preference rows ────────────────────────────────────────────── */}
      <div className="mt-4 divide-y divide-slate-800">

        {/* Theme row */}
        <div className="flex items-center justify-between py-3">
          {/* htmlFor matches ThemeToggle's hard-coded id="theme-toggle" */}
          <label
            htmlFor="theme-toggle"
            className="text-sm text-slate-300 cursor-pointer select-none"
          >
            Theme
          </label>
          <ThemeToggle />
        </div>

      </div>
    </section>
  );
}

/**
 * Allowed heading levels.  Any value outside this set falls back to `'h2'`.
 * @type {readonly string[]}
 */
export const VALID_HEADINGS = /** @type {const} */ (["h1", "h2", "h3", "h4", "h5", "h6"]);
