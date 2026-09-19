// A pending action survives the Google round trip once, and only once
// (seamless-sign-in D6–D8).
import { beforeEach, describe, expect, it, vi } from "vitest";

const { save, toast } = vi.hoisted(() => ({
  save: vi.fn(),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/services/wishlistApiClient", () => ({ wishlistApiClient: { save, remove: vi.fn() } }));

import {
  INTENT_TTL_MS,
  clearStoredIntent,
  runIntent,
  storeIntent,
  takeStoredIntent,
} from "@/lib/auth-intent";

const intent = { kind: "wishlist.save", productId: "prod-1" } as const;

beforeEach(() => {
  sessionStorage.clear();
  save.mockResolvedValue(undefined);
});

describe("the stored intent", () => {
  it("is returned once and removed before it runs, so a reload cannot repeat it", () => {
    storeIntent(intent, 1_000);
    expect(takeStoredIntent(2_000)).toEqual(intent);
    expect(takeStoredIntent(2_000)).toBeNull();
  });

  it("is dropped past ten minutes — a cancelled trip cannot fire later", () => {
    storeIntent(intent, 0);
    expect(takeStoredIntent(INTENT_TTL_MS + 1)).toBeNull();
    // And it is gone, not merely skipped.
    expect(sessionStorage.length).toBe(0);
  });

  it("is discarded by clearing — what closing the sheet does", () => {
    storeIntent(intent);
    clearStoredIntent();
    expect(takeStoredIntent()).toBeNull();
  });

  it("ignores anything that is not a known intent", () => {
    sessionStorage.setItem("bb-auth-intent", JSON.stringify({ intent: { kind: "order.pay" }, at: Date.now() }));
    expect(takeStoredIntent()).toBeNull();
    sessionStorage.setItem("bb-auth-intent", "not json");
    expect(takeStoredIntent()).toBeNull();
  });
});

describe("runIntent", () => {
  it("runs wishlist.save as a save, never a toggle", async () => {
    await runIntent(intent);
    expect(save).toHaveBeenCalledWith("prod-1");
    expect(toast.success).toHaveBeenCalledWith("Added to wishlist");
  });

  it("reports a failure instead of throwing into the sign-in that succeeded", async () => {
    save.mockRejectedValue(new Error("Could not add that to your wishlist"));
    await expect(runIntent(intent)).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith("Could not add that to your wishlist");
  });
});
