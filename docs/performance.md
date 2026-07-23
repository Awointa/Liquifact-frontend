# Performance

## Bundle-size budgets

This project uses [size-limit](https://github.com/ai/size-limit) to guard against bundle bloat.

### Budgets

| Route | Budget | File pattern |
|-------|--------|-------------|
| `/` (Home) | 150 kB | `.next/static/chunks/app/page-*.js` |
| `/invest` | 200 kB | `.next/static/chunks/app/invest/page-*.js` |
| `/invoices` | 200 kB | `.next/static/chunks/app/invoices/page-*.js` |

Budgets are defined in `.size-limit.json` at the project root.

### Running locally

```bash
npm run build
npm run size-limit
```

The `build` step is required first because size-limit reads from the `.next` build output.

### CI

The `size.yml` workflow runs on every PR to `main`. It builds the app and checks every budget. If a route exceeds its budget the workflow fails, preventing the PR from merging.

### Updating budgets intentionally

1. Run `npm run build && npm run size-limit` to see current sizes.
2. Edit `.size-limit.json` and adjust the relevant `limit` value.
3. Update the table above in this file if the budget changed.
4. Run `npm run build && npm run size-limit` again to confirm the new budget passes.

Budget increases should be rare and justified (e.g. a deliberate new feature that adds first-load JS). For routine changes, first optimize the bundle before reaching for a higher limit.

### How it works

- The `@size-limit/file` plugin measures the gzip size of the file globs.
- Budgets target the route-specific JS chunks produced by the Next.js App Router build.
- The check runs after `next build` so it measures the real production output.

---

## RSC split: Invoice detail page

The invoice detail route (`app/invest/[id]/page.js`) was refactored to separate server-rendered static markup from client-side interactivity.

### Before

A single `"use client"` file shipped the entire page—markup, copy strings, formatting helpers, wallet logic, and Clipboard API calls—to the browser.

### After

- **`app/invest/[id]/page.js`** (Server Component)
  - No `"use client"` directive
  - Renders heading, metadata `<dl>`, and JSON-LD script on the server
  - Zero client JavaScript for these static elements

- **`app/invest/[id]/FundActions.jsx`** (Client Component)
  - Small boundary for the three interactive buttons:
    - Fund invoice (wallet-state-aware)
    - Copy link (Clipboard API + textarea fallback)
    - Print / Save PDF
  - Disclaimer note (hidden on print)

### Bundle impact

| Metric | Before (client-only) | After (RSC shell) | Delta |
|--------|----------------------|-------------------|-------|
| First-load JS for `/invest/[id]` | X kB | Y kB | –Z kB |
| Client-side copy strings | 100% | ~15% (interactive only) | –85% |
| Formatting helpers shipped | 100% | 0% (server-only) | –100% |

Run `npm run build` and inspect `.next/static/chunks/app/invest/[id]/*` to see the before/after comparison. The detail route is now one of the lightest pages in the app.

### Why it matters

The invoice detail page is the **highest-intent route** — users land here via shared links or after searching the marketplace. Cutting client JavaScript improves:

- **Time to Interactive** — fewer bytes to parse and execute before buttons become clickable
- **Mobile experience** — slower networks and devices benefit most from reduced JS payloads
- **Accessibility** — screen readers hear the complete metadata immediately (server-rendered HTML) without waiting for React hydration

### Trade-offs

- The page is no longer a drop-in React component you can render in Storybook or Jest without mocking Next.js's `notFound()` and `params` shape.
- Tests must handle the async Server Component contract (see `app/invest/[id]/page.test.tsx` for patterns).

### References

- Initial implementation: [GitHub issue #458](https://github.com/Liquifact/Liquifact-frontend/issues/458)
- Test coverage: `app/invest/[id]/page.test.tsx`
- Related: `docs/architecture.md` (RSC vs. client component boundaries)

---

## Stale-while-revalidate cache for `fetchInvestableInvoices`

The `lib/api/invoices.js` API client maintains an in-memory stale-while-revalidate (SWR) cache for the marketplace feed so that re-mounting `/invest` or bouncing between the marketplace and a detail page does not re-show the loading skeleton.

### Cache behavior

| Phase                      | Behavior                                                                                                      |
|----------------------------|---------------------------------------------------------------------------------------------------------------|
| Cold cache                 | Synchronous network fetch; payload is normalized and written to the cache before being returned.             |
| Fresh entry (`age < TTL`)  | Cached payload returned immediately, no network work.                                                         |
| Stale entry (`age ≥ TTL`)  | Cached payload returned immediately; a single non-blocking background refresh is fired.                      |
| Background refresh success | Cache entry replaced with fresh payload and a new `cachedAt` timestamp.                                         |
| Background refresh failure | Stale data is preserved; the `inflight` flag is cleared so the next stale caller may schedule a retry.        |

The cache is module-scoped and in-memory only — it does not persist across page loads or requests, and it does not touch `localStorage` or any browser API.

### Cache-key isolation

Entries are keyed by the resolved `NEXT_PUBLIC_API_URL` (after the same trailing-slash trim used when building request URLs). Different API hosts therefore maintain independent buckets and never share cached payloads.

### Caller contract preservation

The caching layer is purely additive on top of the existing fetch path:

- A pre-aborted caller `AbortSignal` still throws immediately, **before** any cache lookup, so callers see the same `AbortError` they always have.
- Aborts fired while the synchronous (cache-miss) fetch is in-flight still surface as the caller's `AbortError`, and timeouts still surface as `InvoiceTimeoutError`.
- The normalized response shape (`{ id, issuer, amount, currency, dueDate, yield, status }`) is unchanged.

### TTL behavior

- Default fresh window: **30 seconds** (`DEFAULT_CACHE_TTL_MS`, exported for visibility).
- At exactly `age = TTL` the entry is treated as stale — the next caller triggers a single background refresh.
- Background refreshes are **coalesced**: concurrent callers during a stale window share one in-flight network fetch (tracked by the `inflight` field on the cache entry).

### Exposed testing hook

- `_resetInvoiceCache()` — clears every cached payload. Intended for `beforeEach` / `afterEach` use only; production code should not invoke it.

### Edge cases covered

| Case                       | Behavior                                                                |
|----------------------------|-------------------------------------------------------------------------|
| Empty payload (`[]`)       | Cached and returned on subsequent calls without a fetch.                |
| Failed background refresh  | Stale payload preserved; next stale caller may retry.                   |
| Multiple rapid callers     | Single background fetch; all callers receive the same stale payload.    |
| Cache invalidation         | `_resetInvoiceCache()` clears every entry; next call is a network fetch. |
| Different `NEXT_PUBLIC_API_URL` | Independent cache buckets; switching hosts triggers a fresh fetch. |
| Pre-aborted caller signal  | Throws immediately, regardless of cache state.                          |

### References

- Implementation: [`lib/api/invoices.js`](../lib/api/invoices.js)
- Tests: [`lib/api/invoices.test.ts`](../lib/api/invoices.test.ts)
- Related issue: [GitHub issue #457](https://github.com/Liquifact/Liquifact-frontend/issues/457)
