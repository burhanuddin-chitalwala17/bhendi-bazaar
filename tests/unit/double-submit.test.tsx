/**
 * A double tap is one request, a hung request ends in words, and a busy button stays enabled
 * (docs/GTM-READINESS.md B9). Also the ratchet on `disabled={…pending}`, which only falls.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { useMutation } from "@/hooks/core/useMutation";
import { useServerForm } from "@/hooks/core/useServerForm";
import { apiRequest, OFFLINE_MESSAGE, TIMEOUT_MESSAGE, TIMEOUT_UNSURE_MESSAGE } from "@/lib/api-client";
import { ApiError } from "@/lib/api-error";
import { Button } from "@/components/ui/button";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe("useMutation", () => {
  it("sends once when called twice in the same tick, and both callers get the answer", async () => {
    const answer = deferred<string>();
    const fn = vi.fn(() => answer.promise);
    const { result } = renderHook(() => useMutation(fn, { showToast: false }));

    let first!: Promise<string>, second!: Promise<string>;
    act(() => {
      first = result.current.mutate(undefined);
      second = result.current.mutate(undefined);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => answer.resolve("done"));
    await expect(first).resolves.toBe("done");
    await expect(second).resolves.toBe("done");
  });

  it("sends a call with different variables: another row is another request", async () => {
    const answer = deferred<string>();
    const fn = vi.fn((_row: string) => answer.promise);
    const { result } = renderHook(() => useMutation(fn, { showToast: false }));
    act(() => {
      void result.current.mutate("row-a");
      void result.current.mutate("row-b");
    });
    expect(fn.mock.calls.map(([row]) => row)).toEqual(["row-a", "row-b"]);
    await act(async () => answer.resolve("ok"));
  });

  it("sends again once the first has settled", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const { result } = renderHook(() => useMutation(fn, { showToast: false }));
    await act(() => result.current.mutate(undefined));
    await act(() => result.current.mutate(undefined));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the lock after a failure", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("no")).mockResolvedValue("ok");
    const { result } = renderHook(() => useMutation(fn, { showToast: false }));
    await act(() => result.current.mutate(undefined).catch(() => undefined));
    await act(() => result.current.mutate(undefined));
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("useServerForm", () => {
  it("submits once when submitted twice before the first returns", async () => {
    const answer = deferred<void>();
    const submit = vi.fn(() => answer.promise);
    const { result } = renderHook(() =>
      useServerForm({ schema: z.object({ name: z.string() }), defaultValues: { name: "a" }, submit }),
    );

    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => {
      first = result.current.onSubmit();
      second = result.current.onSubmit();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(submit).toHaveBeenCalledTimes(1);

    await act(async () => answer.resolve());
    await first;
    await second;
  });
});

describe("apiRequest", () => {
  it("ends a hung request with words, not a spinner for ever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
      ),
    );
    const error = await apiRequest("/api/x", { timeoutMs: 10 }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(TIMEOUT_MESSAGE);
  });

  it("does not invite a blind retry of a write that may still land", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
      ),
    );
    const error = await apiRequest("/api/x", { method: "POST", body: {}, timeoutMs: 10 }).catch((e) => e);
    expect(error.message).toBe(TIMEOUT_UNSURE_MESSAGE);
  });

  it("counts a reply that stalls halfway as a timeout", async () => {
    const stalled = {
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.reject(new DOMException("t", "TimeoutError")),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(stalled));
    const error = await apiRequest("/api/x").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(TIMEOUT_MESSAGE);
  });

  it("says so when the network, not the server, failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await apiRequest("/api/x").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(OFFLINE_MESSAGE);
  });

  it("leaves a caller's own cancellation alone", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError")))),
      ),
    );
    const pending = apiRequest("/api/x", { signal: controller.signal }).catch((e) => e);
    controller.abort();
    const error = await pending;
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.name).toBe("AbortError");
  });
});

describe("Button pending", () => {
  it("ignores clicks and says it is busy, but is never disabled", () => {
    const onClick = vi.fn();
    render(
      <Button pending onClick={onClick}>
        Pay
      </Button>,
    );
    const button = screen.getByRole("button", { name: /pay/i });
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("clicks through when not pending", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Pay</Button>);
    fireEvent.click(screen.getByRole("button", { name: /pay/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("cart store", () => {
  it("renders empty until the saved cart is read, then reads it", async () => {
    localStorage.setItem(
      "bhendi-bazaar-cart",
      JSON.stringify({ state: { items: [], updatedAt: new Date().toISOString() }, version: 0 }),
    );
    vi.resetModules();
    const { useCartStore } = await import("@/store/cartStore");
    expect(useCartStore.getState().hasHydrated).toBe(false);
    await act(async () => {
      await useCartStore.persist.rehydrate();
      await Promise.resolve();
    });
    expect(useCartStore.getState().hasHydrated).toBe(true);
  });

  it("never writes over the saved cart before it has been read", async () => {
    const saved = JSON.stringify({ state: { items: [], updatedAt: "2026-01-01T00:00:00.000Z", marker: 1 }, version: 0 });
    localStorage.setItem("bhendi-bazaar-cart", saved);
    vi.resetModules();
    const { useCartStore } = await import("@/store/cartStore");
    useCartStore.getState().setItems([]);
    expect(localStorage.getItem("bhendi-bazaar-cart")).toBe(saved);
  });
});

describe("error screens", () => {
  it("Try again refetches through retry", async () => {
    const { default: StorefrontError } = await import("@/app/(main)/error");
    const retry = vi.fn();
    render(<StorefrontError error={new Error("x")} retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("useCheckoutSnapshot", () => {
  const line = (productId: string) =>
    ({ id: productId, productId, productName: productId, productSlug: productId, price: 100, quantity: 1 }) as never;

  it("waits for the saved cart, takes it once, and ignores later changes", async () => {
    vi.resetModules();
    const { useCartStore } = await import("@/store/cartStore");
    const { useCheckoutSnapshot } = await import("@/components/checkout/hooks/useCheckoutSnapshot");
    useCartStore.setState({ items: [], hasHydrated: false });

    const { result } = renderHook(() => useCheckoutSnapshot());
    expect(result.current.ready).toBe(false);

    act(() => useCartStore.setState({ items: [line("saved")], hasHydrated: true }));
    expect(result.current.ready).toBe(true);
    expect(result.current.items.map((i) => i.productId)).toEqual(["saved"]);

    // The sign-in merge changes the store, never this checkout (seamless-sign-in D11).
    act(() => useCartStore.setState({ items: [line("saved"), line("merged")] }));
    expect(result.current.items.map((i) => i.productId)).toEqual(["saved"]);
  });

  it("a buy-now checkout is ready at once, whatever the cart holds", async () => {
    vi.resetModules();
    const { useCartStore } = await import("@/store/cartStore");
    const { useCheckoutSnapshot } = await import("@/components/checkout/hooks/useCheckoutSnapshot");
    useCartStore.setState({ items: [], hasHydrated: false });
    const { result } = renderHook(() => useCheckoutSnapshot(line("now")));
    expect(result.current.ready).toBe(true);
    expect(result.current.items.map((i) => i.productId)).toEqual(["now"]);
  });
});

/**
 * `disabled` on a busy control hides why it does nothing and drops it from keyboard focus; the
 * replacement is `pending`. Existing gates are counted here and the count only falls (ADR-0056):
 * lower it when you convert one.
 */
const DISABLED_WHILE_BUSY_CEILING = 96;

describe("disabled-while-busy ratchet", () => {
  const SRC = resolve(__dirname, "../../src");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
    });
  const files = walk(SRC);
  const BUSY =
    /disabled=\{[^}]*(pending|Pending|isLoading|isSubmitting|loading|Loading|isAdding|isBuying|saving|Saving|submitting|Submitting|busy|Busy|frozen|isUpdating|isDeleting|isToggling|isRemoving|isCreating)/g;
  const count = files.reduce((n, f) => n + (readFileSync(f, "utf8").match(BUSY)?.length ?? 0), 0);

  it("scans the components at all", () => {
    expect(files.length).toBeGreaterThan(200);
  });

  it("only falls", () => {
    expect(count, `found ${count}; convert to \`pending\`, never add one`).toBeLessThanOrEqual(DISABLED_WHILE_BUSY_CEILING);
  });
});
