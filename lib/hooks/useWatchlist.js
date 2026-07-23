/**
 * @file lib/hooks/useWatchlist.js
 *
 * A persisted watchlist hook built on top of `useLocalStorage`.
 *
 * Manages a set of invoice IDs that the investor has "starred" for
 * follow-up.  The watchlist survives page reloads and browser sessions
 * because the underlying `useLocalStorage` hook serialises the ID array
 * into `localStorage` under the key `"liquifact:watchlist"`.
 *
 * Contract
 * ────────
 * • The watchlist is initialised as an empty array.  After mount the
 *   stored value is read from localStorage and adopted.
 * • `toggleWatch(invoiceId)` adds the ID if absent and removes it if
 *   present.
 * • `isWatched(invoiceId)` returns `true` when the ID is in the list.
 * • `pruneWatchlist(validIds)` removes any IDs that are NOT in the
 *   supplied list of valid IDs — use this after loading invoices to
 *   clean up IDs for invoices that no longer exist in the API.
 * • All side-effects are safe for SSR (the underlying `useLocalStorage`
 *   never reads or writes storage during render).
 *
 * @example
 * ```jsx
 * import useWatchlist from "@/lib/hooks/useWatchlist";
 *
 * function InvoiceCard({ invoice }) {
 *   const { watchlist, toggleWatch, isWatched } = useWatchlist();
 *   const watched = isWatched(invoice.id);
 *
 *   return (
 *     <div>
 *       <button
 *         aria-pressed={watched}
 *         onClick={() => toggleWatch(invoice.id)}
 *       >
 *         {watched ? "★" : "☆"}
 *       </button>
 *       ...
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";

const STORAGE_KEY = "liquifact:watchlist";

/**
 * @returns {{
 *   watchlist: string[],
 *   toggleWatch: (invoiceId: string) => void,
 *   isWatched: (invoiceId: string) => boolean,
 *   pruneWatchlist: (validIds: string[]) => void,
 * }}
 */
export default function useWatchlist() {
  const [watchlist, setWatchlist] = useLocalStorage(STORAGE_KEY, /** @type {string[]} */ ([]));

  /**
   * Add or remove an invoice ID from the watchlist.
   * If the ID is already watched, it is removed; otherwise it is appended.
   * @param {string} invoiceId
   */
  const toggleWatch = useCallback(
    (invoiceId) => {
      setWatchlist((prev) => {
        if (!Array.isArray(prev)) return [invoiceId];
        if (prev.includes(invoiceId)) {
          return prev.filter((id) => id !== invoiceId);
        }
        return [...prev, invoiceId];
      });
    },
    [setWatchlist]
  );

  /**
   * Check whether an invoice ID is currently watched.
   * @param {string} invoiceId
   * @returns {boolean}
   */
  const isWatched = useCallback(
    (invoiceId) => {
      return Array.isArray(watchlist) && watchlist.includes(invoiceId);
    },
    [watchlist]
  );

  /**
   * Remove all IDs from the watchlist that are NOT in `validIds`.
   * Call this after loading invoices from the API to prune stale
   * references to invoices that no longer exist.
   * @param {string[]} validIds
   */
  const pruneWatchlist = useCallback(
    (validIds) => {
      if (!Array.isArray(validIds)) return;
      setWatchlist((prev) => {
        if (!Array.isArray(prev)) return [];
        const valid = new Set(validIds);
        const pruned = prev.filter((id) => valid.has(id));
        // Avoid a write when nothing changed.
        if (pruned.length === prev.length) return prev;
        return pruned;
      });
    },
    [setWatchlist]
  );

  // Memoise the returned object so consumers can safely use it in
  // dependency arrays without causing infinite re-renders.
  return useMemo(
    () => ({ watchlist, toggleWatch, isWatched, pruneWatchlist }),
    [watchlist, toggleWatch, isWatched, pruneWatchlist]
  );
}
