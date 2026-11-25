// A bar button spins only once its work is slow (bulk-actions ux.md "Slow": past 3 s).
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDelayedFlag } from "@/hooks/core/useDelayedFlag";

afterEach(() => vi.useRealTimers());

describe("useDelayedFlag", () => {
  it("turns on after the delay and off at once", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ on }) => useDelayedFlag(on, 3000), { initialProps: { on: true } });
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(2999));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
    rerender({ on: false });
    expect(result.current).toBe(false);
  });
});
