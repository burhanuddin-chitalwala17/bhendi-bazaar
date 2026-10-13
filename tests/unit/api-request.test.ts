import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { apiRequest } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import { useAsyncData } from "@/hooks/core/useAsyncData";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
  it("sends a plain body as JSON and returns the parsed reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/x", { method: "POST", body: { a: 1 } })).resolves.toEqual({ ok: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("sends FormData untouched, so the browser sets the multipart boundary", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();

    await apiRequest("/api/upload", { method: "POST", body: form });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });

  it("throws the envelope as an ApiError, field details included", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      json({ error: "Invalid", details: [{ path: "sku", message: "Taken" }] }, 409),
    ));

    const error = await apiRequest("/api/x").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: "Invalid", details: [{ path: "sku", message: "Taken" }] });
  });

  it("returns undefined for an empty reply instead of failing to parse it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(apiRequest("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("useAsyncData", () => {
  it("drops a stale reply that lands after a newer one", async () => {
    const resolvers: Record<string, (v: string) => void> = {};
    const fetcher = (key: string) => () => new Promise<string>((resolve) => (resolvers[key] = resolve));

    const { result, rerender } = renderHook(({ k }) => useAsyncData(fetcher(k), { refetchDependencies: [k] }), {
      initialProps: { k: "old" },
    });
    rerender({ k: "new" });

    await act(async () => resolvers.new("new"));
    await act(async () => resolvers.old("old"));
    await waitFor(() => expect(result.current.data).toBe("new"));
    expect(result.current.loading).toBe(false);
  });

  it("aborts the previous request when its inputs change", async () => {
    const signals: AbortSignal[] = [];
    const { rerender } = renderHook(
      ({ k }) => useAsyncData((signal) => (signals.push(signal), new Promise(() => {})), { refetchDependencies: [k] }),
      { initialProps: { k: 1 } },
    );
    rerender({ k: 2 });
    await waitFor(() => expect(signals.length).toBe(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
