/**
 * The listings page follows a running read by its progress, not by re-rendering itself every few
 * seconds: refresh when the read ends, at most every half-minute while rows arrive, and stop asking
 * after the limit so an open tab costs nothing overnight.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const progress = vi.hoisted(() => ({ next: { state: "RUNNING", done: 0, stalled: false } as Record<string, unknown>, calls: 0 }));
vi.mock("@/components/channel/listingsApiClient", () => ({
  listingsApiClient: {
    readProgress: async () => {
      progress.calls++;
      return progress.next;
    },
  },
}));

import { READ_POLL_LIMIT_MS, READ_POLL_MS, useReadProgress } from "@/components/channel/useReadProgress";

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useReadProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    progress.calls = 0;
    progress.next = { state: "RUNNING", done: 0, stalled: false };
  });
  afterEach(() => vi.useRealTimers());

  it("does not refresh the page on every poll while a read runs", async () => {
    const refresh = vi.fn();
    renderHook(() => useReadProgress("org", "amazon", true, refresh));
    for (let i = 1; i <= 5; i++) {
      progress.next = { state: "RUNNING", done: i, stalled: false };
      await advance(READ_POLL_MS);
    }
    expect(progress.calls).toBe(5);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes once when the read finishes, and stops asking", async () => {
    const refresh = vi.fn();
    renderHook(() => useReadProgress("org", "amazon", true, refresh));
    progress.next = { state: "DONE", done: 10, stalled: false };
    await advance(READ_POLL_MS);
    await advance(READ_POLL_MS * 5);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(progress.calls).toBe(1);
  });

  it("gives up after the limit", async () => {
    const { result } = renderHook(() => useReadProgress("org", "amazon", true, vi.fn()));
    await advance(READ_POLL_LIMIT_MS + READ_POLL_MS);
    const asked = progress.calls;
    expect(result.current.gaveUp).toBe(true);
    await advance(READ_POLL_MS * 10);
    expect(progress.calls).toBe(asked);
  });

  it("asks nothing while no read runs", async () => {
    renderHook(() => useReadProgress("org", "amazon", false, vi.fn()));
    await advance(READ_POLL_MS * 10);
    expect(progress.calls).toBe(0);
  });
});
