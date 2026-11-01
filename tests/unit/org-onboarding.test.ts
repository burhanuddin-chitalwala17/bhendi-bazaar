// The setup list's rules (own-store seller-onboarding R3, A1, A6; D5; Q2, Q3, Q19): five steps in
// the owner's order, each ticked by a fact the shop already has, and hidden only by the shop.
// Pure — the facts are handed in, so no database is involved.
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEP,
  ONBOARDING_STEPS,
  deriveOnboarding,
  type OnboardingFacts,
  type OnboardingStatus,
  type OnboardingStep,
} from "@server/catalog/org-onboarding.types";

const facts = (overrides: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  productsOnSale: 0,
  pickupReady: false,
  hasLogo: false,
  hasTagline: false,
  shared: false,
  hidden: false,
  ...overrides,
});

const everything = (): OnboardingFacts =>
  facts({ productsOnSale: 1, pickupReady: true, hasLogo: true, hasTagline: true, shared: true });

const stepDone = (status: OnboardingStatus, key: OnboardingStep) =>
  status.steps.find((step) => step.key === key)?.done;

describe("the five steps (Q2, Q19)", () => {
  it("run open, product, pickup address, logo and line, share", () => {
    expect(deriveOnboarding(facts()).steps.map((step) => step.key)).toEqual([
      ONBOARDING_STEP.OPEN,
      ONBOARDING_STEP.PRODUCT,
      ONBOARDING_STEP.ADDRESS,
      ONBOARDING_STEP.LOOK,
      ONBOARDING_STEP.SHARE,
    ]);
    expect(ONBOARDING_STEPS).toHaveLength(5);
  });

  it("a new shop starts at 1 of 5 done, the next step the first product (A1)", () => {
    const status = deriveOnboarding(facts());
    expect(stepDone(status, ONBOARDING_STEP.OPEN)).toBe(true);
    expect(status.doneCount).toBe(1);
    expect(status.next).toBe(ONBOARDING_STEP.PRODUCT);
    expect(status.complete).toBe(false);
  });
});

describe("each step ticks from its own fact (Q3, A6)", () => {
  it("product: a product on sale", () => {
    expect(stepDone(deriveOnboarding(facts()), ONBOARDING_STEP.PRODUCT)).toBe(false);
    expect(stepDone(deriveOnboarding(facts({ productsOnSale: 1 })), ONBOARDING_STEP.PRODUCT)).toBe(true);
  });

  it("pickup address: an active location with a street and a contact", () => {
    expect(stepDone(deriveOnboarding(facts()), ONBOARDING_STEP.ADDRESS)).toBe(false);
    expect(stepDone(deriveOnboarding(facts({ pickupReady: true })), ONBOARDING_STEP.ADDRESS)).toBe(true);
  });

  it("logo and line: both, never one alone", () => {
    expect(stepDone(deriveOnboarding(facts({ hasLogo: true })), ONBOARDING_STEP.LOOK)).toBe(false);
    expect(stepDone(deriveOnboarding(facts({ hasTagline: true })), ONBOARDING_STEP.LOOK)).toBe(false);
    expect(stepDone(deriveOnboarding(facts({ hasLogo: true, hasTagline: true })), ONBOARDING_STEP.LOOK)).toBe(true);
  });

  it("share: the first recorded tap", () => {
    expect(stepDone(deriveOnboarding(facts()), ONBOARDING_STEP.SHARE)).toBe(false);
    expect(stepDone(deriveOnboarding(facts({ shared: true })), ONBOARDING_STEP.SHARE)).toBe(true);
  });

  it("counts what is done, and the next step is the first one not done, in order", () => {
    const status = deriveOnboarding(facts({ pickupReady: true, shared: true }));
    expect(status.doneCount).toBe(3);
    expect(status.next).toBe(ONBOARDING_STEP.PRODUCT);
  });

  it("is complete with every fact, and then has no next step", () => {
    const status = deriveOnboarding(everything());
    expect(status.doneCount).toBe(5);
    expect(status.complete).toBe(true);
    expect(status.next).toBeNull();
  });
});

describe("hidden (Q6, A6)", () => {
  it("is the shop's own choice, and does not change what is done", () => {
    expect(deriveOnboarding(facts()).hidden).toBe(false);
    const hidden = deriveOnboarding(facts({ hidden: true, productsOnSale: 2 }));
    expect(hidden.hidden).toBe(true);
    expect(hidden.doneCount).toBe(2);
  });
});
