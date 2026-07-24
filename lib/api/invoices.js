import { loadEnv } from "../config/env";

// lib/api/invoices.js

const DEFAULT_TIMEOUT_MS = 10_000;
// Fresh window for the in-memory SWR cache. After this elapses, the next
// caller returns the cached payload immediately and fires a single
// non-blocking background refresh.
export const DEFAULT_CACHE_TTL_MS = 30_000;

export class InvoiceTimeoutError extends Error {
  constructor(ms) {
    super(`Request timed out after ${ms}ms`);
    this.name = "InvoiceTimeoutError";
  }
}

// Module-level in-memory SWR cache, keyed by the resolved API base URL so
// different `NEXT_PUBLIC_API_URL` values never share cached payloads.
//
// Each entry holds:
//   - data:     the most recent normalized invoice array.
//   - cachedAt: ms-since-epoch captured when `data` was last written.
//   - inflight: the Promise of an in-flight background refresh, or null.
const cache = new Map();

/**
 * Test-only hook. Clears every cached invoice response so the next call
 * observes a cold cache. Intended for `beforeEach` / `afterEach` use only;
 * production code should not invoke it.
 */
export function _resetInvoiceCache() {
  cache.clear();
}

function resolveBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

// Issue a single GET against `${baseUrl}/invoices` and normalize the response
// into the existing item contract. Used by both the cold-cache path (with a
// caller-supplied signal) and the background-revalidation path (no signal).
async function fetchOnce({ baseUrl, signal, timeoutMs }) {
  const url = `${baseUrl.replace(/\/+$/, "")}/invoices`;

  const controller = new AbortController();

  if (signal) {
    if (signal.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      if (timedOut) throw new InvoiceTimeoutError(timeoutMs);
      throw err;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch invoices: ${response.status} ${response.statusText}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (e) {
    throw new Error("Response is not valid JSON");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Invoice payload is not an array");
  }

  // Normalize each invoice to the UI contract, clamping and sanitizing string fields.
  const normalized = payload.map((inv) => {
    const {
      id = null,
      issuer = null,
      description = null,
      reference = null,
      amount = null,
      currency = null,
      dueDate = null,
      yield: invYield = null,
      status = null,
    } = inv || {};

    return {
      id,
      issuer: clampAndSanitizeText(issuer),
      description: clampAndSanitizeText(description, 1024),
      reference: clampAndSanitizeText(reference),
      amount,
      currency,
      dueDate,
      yield: invYield,
      status,
    };
  });

  return normalized;
}

// Background refresh: fetch fresh data and replace the cache entry on
// success. On failure the cached entry is left untouched so stale data is
// still served; the `inflight` flag is always cleared so the next stale
// caller can schedule a new attempt. Never throws to the caller.
//
// `entry` is the cache entry captured at schedule time; the populate-vs-
// cleared decision only fires when our entry is still the active one — a
// concurrent reset or fresh fetch must not be overwritten with stale data.
async function backgroundRevalidate(entry, baseUrl, timeoutMs) {
  try {
    const data = await fetchOnce({ baseUrl, timeoutMs });
    if (cache.get(baseUrl) === entry) {
      cache.set(baseUrl, { data, cachedAt: Date.now(), inflight: null });
    }
  } catch {
    if (cache.get(baseUrl) === entry) {
      entry.inflight = null;
    }
  }
}

/**
 * Fetch investable invoices from the backend API.
 *
 * Caching: this function maintains a module-level stale-while-revalidate
 * cache keyed by `NEXT_PUBLIC_API_URL`. Within `DEFAULT_CACHE_TTL_MS`, the
 * cached payload is returned without a network call. After the TTL elapses,
 * the cached payload is still returned immediately, but a single background
 * refresh is fired so the next caller observes fresh data.
 *
 * @param {Object} options
 * @param {AbortSignal} [options.signal] - Optional AbortSignal to cancel the request.
 *   Always honored before cache lookups so a pre-aborted signal still throws.
 * @param {number} [options.timeoutMs=10000] - Milliseconds before the request is aborted.
 * @returns {Promise<Array<Object>>} Resolves to an array of normalized invoice objects.
 * @throws {InvoiceTimeoutError} Thrown when the request exceeds `timeoutMs`.
 *   Only ever thrown on the synchronous cache-miss path; background refreshes
 *   catch timeouts internally.
 * @throws {Error} Thrown when the network request fails, the response status is not OK,
 *                 or when the response payload is not an array. Only thrown on the
 *                 cache-miss path.
 */
export async function fetchInvestableInvoices({ signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const baseUrl = resolveBaseUrl();

  // Honor a pre-aborted caller signal before touching the cache so callers
  // see the same AbortError they always have.
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("Aborted", "AbortError");
  }

  const now = Date.now();
  const entry = cache.get(baseUrl);

  if (entry) {
    if (now - entry.cachedAt < DEFAULT_CACHE_TTL_MS) {
      // Fresh: return cached payload, do no network work.
      return entry.data;
    }

    // Stale: return cached payload immediately, but coalesce concurrent
    // refresh requests into a single in-flight background fetch.
    if (!entry.inflight) {
      entry.inflight = backgroundRevalidate(entry, baseUrl, timeoutMs);
    }
    return entry.data;
  }

  // Cache miss: synchronous fetch, then store so the next call is cheap.
  const data = await fetchOnce({ baseUrl, signal, timeoutMs });
  cache.set(baseUrl, { data, cachedAt: Date.now(), inflight: null });
  return data;
}
