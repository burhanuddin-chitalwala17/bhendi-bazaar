// A lock is a 403 whose `feature` detail names it, in the one envelope (subscriptions/feature-access D4, ADR-0013).
import { describe, expect, it } from "vitest";
import { FeatureLockedError } from "@server/shared/domain-error";
import { toErrorResponse } from "@/lib/api-error-response";

describe("a feature lock in the error envelope", () => {
  it("is a 403 naming the feature, with the plan's sentence as its message", async () => {
    const response = toErrorResponse(new FeatureLockedError("channels", "Channels"), "fallback");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Channels is part of the ₹699 plan",
      details: [{ path: "feature", message: "channels" }],
    });
  });
});
