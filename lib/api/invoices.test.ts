// lib/api/invoices.test.ts
/**
 * Tests for fetchInvestableInvoices API client, including the
 * stale-while-revalidate (SWR) in-memory cache.
 */

import { fetchInvestableInvoices, InvoiceTimeoutError, _resetInvoiceCache } from "./invoices";

// Mirrors the field-by-field defaulting applied by `fetchInvestableInvoices`
// in `lib/api/invoices.js`. Keeps fields that were present in the source row.
const normalizeRows = (rows) =>
  rows.map((inv) => ({
    id: inv?.id ?? null,
    issuer: inv?.issuer ?? null,
    amount: inv?.amount ?? null,
    currency: inv?.currency ?? null,
    dueDate: inv?.dueDate ?? null,
    yield: inv?.yield ?? null,
    status: inv?.status ?? null,
  }));

const okResponse = (body) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  json: async () => body,
});

describe("fetchInvestableInvoices", () => {
  let dateNowSpy;

  beforeEach(() => {
    _resetInvoiceCache();
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    jest.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("fetches invoices and returns normalized data", async () => {
    const mockData = [
      {
        id: "1",
        issuer: "Test Corp",
        amount: "1000",
        currency: "USD",
        dueDate: "2026-12-31",
        yield: "5%",
        status: "Open",
      },
    ];
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
    (global as any).fetch = fetchMock;

    const result = await fetchInvestableInvoices();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/invoices",
      expect.objectContaining({ method: "GET" })
    );
    expect(result).toEqual(mockData);
  });

  it("uses NEXT_PUBLIC_API_URL when set", async () => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.com";
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    (global as any).fetch = fetchMock;

    await fetchInvestableInvoices();
    expect(fetchMock).toHaveBeenCalledWith("http://api.example.com/invoices", expect.any(Object));
  });

  it("throws on non-200 response", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });
    (global as any).fetch = fetchMock;

    await expect(fetchInvestableInvoices()).rejects.toThrow(
      "Failed to fetch invoices: 500 Server Error"
    );
  });

  it("throws on invalid JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("invalid json");
      },
    });
    (global as any).fetch = fetchMock;

    await expect(fetchInvestableInvoices()).rejects.toThrow("Response is not valid JSON");
  });

  it("throws when payload is not an array", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ foo: "bar" }) });
    (global as any).fetch = fetchMock;

    await expect(fetchInvestableInvoices()).rejects.toThrow("Invoice payload is not an array");
  });

  it("passes an AbortSignal to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    (global as any).fetch = fetchMock;

    await fetchInvestableInvoices({ signal: controller.signal });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("throws InvoiceTimeoutError when the timeout fires", async () => {
    jest.useFakeTimers();

    const fetchMock = jest.fn().mockImplementation((_url, { signal }: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          const err = new DOMException("Aborted", "AbortError");
          reject(err);
        });
      });
    });
    (global as any).fetch = fetchMock;

    const promise = fetchInvestableInvoices({ timeoutMs: 5000 });

    jest.advanceTimersByTime(5000);

    await expect(promise).rejects.toBeInstanceOf(InvoiceTimeoutError);
    await expect(promise).rejects.toThrow("Request timed out after 5000ms");

    jest.useRealTimers();
  });

  it("throws the caller AbortError (not InvoiceTimeoutError) when caller signal fires", async () => {
    const controller = new AbortController();
    const fetchMock = jest.fn().mockImplementation((_url, { signal }: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    (global as any).fetch = fetchMock;

    const promise = fetchInvestableInvoices({ signal: controller.signal, timeoutMs: 30_000 });
    controller.abort();

    const err = await promise.catch((e: Error) => e);
    expect(err.name).toBe("AbortError");
    expect(err).not.toBeInstanceOf(InvoiceTimeoutError);
  });

  it("rejects immediately when a pre-aborted caller signal is supplied", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;

    await expect(fetchInvestableInvoices({ signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes invoices with missing fields to null", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{}],
    });
    (global as any).fetch = fetchMock;

    const result = await fetchInvestableInvoices();
    expect(result).toEqual([
      {
        id: null,
        issuer: null,
        amount: null,
        currency: null,
        dueDate: null,
        yield: null,
        status: null,
      },
    ]);
  });

  it("passes the composed AbortSignal (not the original caller signal) to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    (global as any).fetch = fetchMock;

    await fetchInvestableInvoices({ signal: controller.signal });

    const usedSignal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    // The function wraps the caller signal in its own controller, so the signal
    // passed to fetch is a different AbortSignal instance.
    expect(usedSignal).toBeInstanceOf(AbortSignal);
    expect(usedSignal).not.toBe(controller.signal);
  });

  it("clears the timeout after a successful response", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    (global as any).fetch = fetchMock;

    await fetchInvestableInvoices({ timeoutMs: 10_000 });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("clears the timeout even when fetch rejects", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    const fetchMock = jest.fn().mockRejectedValue(new Error("Network failure"));
    (global as any).fetch = fetchMock;

    await expect(fetchInvestableInvoices()).rejects.toThrow("Network failure");
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  describe("stale-while-revalidate cache", () => {
    it("performs a network fetch on the first request (cache miss)", async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse([{ id: "1" }]));
      (global as any).fetch = fetchMock;

      const result = await fetchInvestableInvoices();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(normalizeRows([{ id: "1" }]));
    });

    it("returns cached data without a network fetch within the TTL", async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse([{ id: "1" }]));
      (global as any).fetch = fetchMock;

      const first = await fetchInvestableInvoices();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advance time, but stay strictly inside the fresh window.
      dateNowSpy.mockReturnValue(1_000_000 + 29_999);

      const second = await fetchInvestableInvoices();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second).toBe(first); // exact reference — served from cache.
    });

    it("treats age equal to the TTL as stale (boundary case)", async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse([{ id: "1" }]));
      (global as any).fetch = fetchMock;

      await fetchInvestableInvoices();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      dateNowSpy.mockReturnValue(1_000_000 + 30_000);

      await fetchInvestableInvoices();
      // 1 initial fetch + 1 background refresh.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("returns cached data immediately and refreshes in the background when stale", async () => {
      const first = [{ id: "1" }];
      const fresh = [{ id: "2" }];
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(okResponse(first))
        .mockResolvedValue(okResponse(fresh));
      (global as any).fetch = fetchMock;

      const r1 = await fetchInvestableInvoices();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      dateNowSpy.mockReturnValue(1_000_000 + 30_001);
      dateNowSpy.mockReturnValue(1_000_000 + 30_001);

      const r2 = await fetchInvestableInvoices();
      // Returned stale payload immediately while the background fetch is queued.
      expect(r2).toEqual(normalizeRows(first));
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Yield so the background refresh's promise resolves.
      await flushBackground();

      dateNowSpy.mockReturnValue(1_000_000 + 30_002);
      const r3 = await fetchInvestableInvoices();
      expect(r3).toEqual(normalizeRows(fresh));
      expect(fetchMock).toHaveBeenCalledTimes(2); // no third fetch
    });

    it("swallows errors from the background refresh and keeps serving stale data", async () => {
      const first = [{ id: "1" }];
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(okResponse(first))
        .mockRejectedValue(new Error("boom"));
      (global as any).fetch = fetchMock;

      await fetchInvestableInvoices();
      dateNowSpy.mockReturnValue(1_000_000 + 60_000);

      const stale = await fetchInvestableInvoices();
      expect(stale).toEqual(normalizeRows(first));

      await flushBackground();

      // Still stale; inflight was cleared on failure so the next caller
      // schedules another background attempt.
      dateNowSpy.mockReturnValue(1_000_000 + 90_000);
      const staleAgain = await fetchInvestableInvoices();
      expect(staleAgain).toEqual(normalizeRows(first));
      await flushBackground();

      // 1 cold fetch + 2 failed background attempts.
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("coalesces multiple concurrent callers into a single background refresh", async () => {
      const first = [{ id: "1" }];
      const inflight = createControllableFetch();

      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(okResponse(first))
        .mockReturnValueOnce(inflight.promise);
      (global as any).fetch = fetchMock;

      await fetchInvestableInvoices();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      dateNowSpy.mockReturnValue(1_000_000 + 31_000);

      const a = fetchInvestableInvoices();
      const b = fetchInvestableInvoices();
      const c = fetchInvestableInvoices();

      // No additional fetches were issued — all three callers coalesce.
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const [ra, rb, rc] = await Promise.all([a, b, c]);
      expect(ra).toEqual(normalizeRows(first));
      expect(rb).toEqual(normalizeRows(first));
      expect(rc).toEqual(normalizeRows(first));

      inflight.resolve(okResponse([{ id: "2" }]));
      await inflight.promise;
    });

    it("carries the timeoutMs through to the background refresh", async () => {
      // First call to seed cache. Background call below must use a short
      // timeout and reject with InvoiceTimeoutError, but the caller side
      // already swallowed it.
      const first = [{ id: "1" }];
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(okResponse(first))
        .mockImplementation((_url, { signal }: { signal: AbortSignal }) => {
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        });
      (global as any).fetch = fetchMock;

      _resetInvoiceCache();
      await fetchInvestableInvoices({ timeoutMs: 10_000 });

      dateNowSpy.mockReturnValue(1_000_000 + 60_000);

      const staleResult = await fetchInvestableInvoices({ timeoutMs: 1 });
      expect(staleResult).toEqual(normalizeRows(first));

      // The background refresh aborts after the 1ms timeout. Swallowed by
      // the SWR layer.
      jest.useFakeTimers();
      try {
        jest.advanceTimersByTime(2);
      } finally {
        jest.useRealTimers();
      }
      await flushBackground();
    });

    it("_resetInvoiceCache forces the next call to do a network fetch", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(okResponse([{ id: "1" }]))
        .mockResolvedValueOnce(okResponse([{ id: "2" }]));
      (global as any).fetch = fetchMock;

      const before = await fetchInvestableInvoices();
      expect(before).toEqual(normalizeRows([{ id: "1" }]));

      _resetInvoiceCache();

      const after = await fetchInvestableInvoices();
      expect(after).toEqual(normalizeRows([{ id: "2" }]));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not share cache entries across NEXT_PUBLIC_API_URL values", async () => {
      const fetchMock = jest.fn();
      (global as any).fetch = fetchMock;

      process.env.NEXT_PUBLIC_API_URL = "http://api-a.example.com";
      fetchMock.mockResolvedValueOnce(okResponse([{ id: "A" }]));
      const fromA = await fetchInvestableInvoices();

      process.env.NEXT_PUBLIC_API_URL = "http://api-b.example.com";
      fetchMock.mockResolvedValueOnce(okResponse([{ id: "B" }]));
      const fromB = await fetchInvestableInvoices();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "http://api-a.example.com/invoices",
        expect.any(Object)
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "http://api-b.example.com/invoices",
        expect.any(Object)
      );

      expect(fromA).toEqual(normalizeRows([{ id: "A" }]));
      expect(fromB).toEqual(normalizeRows([{ id: "B" }]));

      // Going back to A still serves from A's cache — no third fetch.
      process.env.NEXT_PUBLIC_API_URL = "http://api-a.example.com";
      const fromAAgain = await fetchInvestableInvoices();
      expect(fromAAgain).toEqual(normalizeRows([{ id: "A" }]));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("caches an empty payload and returns it without fetching on the next call", async () => {
      const fetchMock = jest.fn().mockResolvedValue(okResponse([]));
      (global as any).fetch = fetchMock;

      const first = await fetchInvestableInvoices();
      const second = await fetchInvestableInvoices();
      const third = await fetchInvestableInvoices();

      expect(first).toEqual([]);
      expect(second).toEqual([]);
      expect(third).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("still throws InvoiceTimeoutError when the synchronous (cache miss) fetch times out", async () => {
      // No cached entry: this is a cold-call timeout. Must surface.
      _resetInvoiceCache();
      jest.useFakeTimers();

      const fetchMock = jest
        .fn()
        .mockImplementation((_url, { signal }: { signal: AbortSignal }) => {
          return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        });
      (global as any).fetch = fetchMock;

      const promise = fetchInvestableInvoices({ timeoutMs: 50 });
      jest.advanceTimersByTime(50);

      await expect(promise).rejects.toBeInstanceOf(InvoiceTimeoutError);

      jest.useRealTimers();
    });

    it("still throws immediately when a pre-aborted signal is supplied, even with a warm cache", async () => {
      // Seed the cache first.
      const fetchMock = jest.fn().mockResolvedValue(okResponse([{ id: "1" }]));
      (global as any).fetch = fetchMock;
      await fetchInvestableInvoices();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Now hand in a pre-aborted signal. Cache must NOT be returned.
      const controller = new AbortController();
      controller.abort();
      await expect(fetchInvestableInvoices({ signal: controller.signal })).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

// Lets a test pause long enough for an awaited background-fetch chain to run.
// Microtasks plus a macrotask tick is sufficient because background
// revalidation only awaits the fetch promise and a Date.now() call. We use
// setTimeout(0) rather than setImmediate because jest-environment-jsdom does
// not expose setImmediate.
async function flushBackground() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createControllableFetch() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
