// A task opened from Home comes back to Home, and only to Home (seller-onboarding R7, A2; D8).
// `from` and `done` arrive in the URL, so they are untrusted: each is matched against a closed
// set and never read as a path, or a crafted link would become an open redirect.
import { describe, expect, it } from "vitest";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";
import { RETURN_TO, homeAfter, parseDoneStep, parseReturnTo, returnHref, taskHref } from "@/components/org/home/return-to";

describe("RETURN_TO", () => {
  it("accepts only its own members", () => {
    expect(parseReturnTo(RETURN_TO.HOME)).toBe(RETURN_TO.HOME);
    for (const hostile of ["https://evil.example", "//evil.example", "/org/other", "HOME", "home ", "", undefined, null, ["home"]]) {
      expect(parseReturnTo(hostile)).toBeNull();
    }
  });

  it("builds Home's own path from the org id, whatever the URL said", () => {
    expect(returnHref("org_1", "https://evil.example", ONBOARDING_STEP.PRODUCT)).toBeNull();
    expect(returnHref("org_1", RETURN_TO.HOME, ONBOARDING_STEP.PRODUCT)).toBe("/org/org_1?done=product");
    expect(homeAfter("org_1", ONBOARDING_STEP.ADDRESS)).toBe("/org/org_1?done=address");
  });
});

describe("done", () => {
  it("is a step or nothing", () => {
    expect(parseDoneStep("look")).toBe(ONBOARDING_STEP.LOOK);
    for (const junk of ["<script>", "products", ["product"], undefined]) expect(parseDoneStep(junk)).toBeNull();
  });
});

describe("a step's task", () => {
  it("carries from=home, so its save comes back (A2)", () => {
    expect(taskHref("org_1", ONBOARDING_STEP.PRODUCT)).toBe("/org/org_1/products/new?from=home");
    expect(taskHref("org_1", ONBOARDING_STEP.ADDRESS)).toBe("/org/org_1/locations?from=home");
    expect(taskHref("org_1", ONBOARDING_STEP.LOOK)).toBe("/org/org_1/shop/details?from=home");
    expect(taskHref("org_1", ONBOARDING_STEP.OPEN)).toBeNull();
  });
});
