// Onboarding's rules (docs/specs/seller-profile/, PR 3): which of the three steps counts as
// done, what the store says it is missing and in what words, that the marketplace channels
// answer "unknown" rather than inventing a rule, and when the card may collapse. Pure — the
// facts are handed in, so no database is involved.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CHANNEL,
  CHANNELS,
  ONBOARDING_STEP,
  ONBOARDING_STEPS,
  READINESS_STATE,
  STORE_MISSING,
  deriveOnboarding,
  type OnboardingFacts,
  type OnboardingStatus,
  type OnboardingStep,
} from "@server/catalog/org-onboarding.types";

const facts = (overrides: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  hasDescription: false,
  brandCount: 0,
  hasDefaults: false,
  locationCount: 0,
  productsOnSale: 0,
  ...overrides,
});

const everything = (): OnboardingFacts =>
  facts({ hasDescription: true, brandCount: 1, hasDefaults: true, locationCount: 1, productsOnSale: 1 });

const stepDone = (status: OnboardingStatus, key: OnboardingStep) =>
  status.steps.find((step) => step.key === key)?.done;

const store = (status: OnboardingStatus) =>
  status.readiness.find((entry) => entry.channel === CHANNEL.STORE)!;

describe("the three steps", () => {
  it("come in order: open, describe, sell", () => {
    expect(deriveOnboarding(facts()).steps.map((step) => step.key)).toEqual([
      ONBOARDING_STEP.OPEN,
      ONBOARDING_STEP.DESCRIBE,
      ONBOARDING_STEP.SELL,
    ]);
    expect(ONBOARDING_STEPS).toHaveLength(3);
  });

  it("open is done for a bare org — the org existing is the step", () => {
    expect(stepDone(deriveOnboarding(facts()), ONBOARDING_STEP.OPEN)).toBe(true);
  });

  it("describe is done once the profile has a description", () => {
    expect(stepDone(deriveOnboarding(facts()), ONBOARDING_STEP.DESCRIBE)).toBe(false);
    expect(stepDone(deriveOnboarding(facts({ hasDescription: true })), ONBOARDING_STEP.DESCRIBE)).toBe(true);
  });

  it("sell is done with a brand, or with any default — not with neither", () => {
    expect(stepDone(deriveOnboarding(facts()), ONBOARDING_STEP.SELL)).toBe(false);
    expect(stepDone(deriveOnboarding(facts({ brandCount: 1 })), ONBOARDING_STEP.SELL)).toBe(true);
    expect(stepDone(deriveOnboarding(facts({ hasDefaults: true })), ONBOARDING_STEP.SELL)).toBe(true);
  });

  it("a step's done state does not depend on the store's readiness", () => {
    const status = deriveOnboarding(facts({ hasDescription: true, brandCount: 1 }));
    expect(status.steps.every((step) => step.done)).toBe(true);
    expect(store(status).state).toBe(READINESS_STATE.NOT_READY);
  });
});

describe("the store's readiness", () => {
  it("names both things to do, location first, when the org has neither", () => {
    const entry = store(deriveOnboarding(facts()));
    expect(entry.state).toBe(READINESS_STATE.NOT_READY);
    expect(entry.missing).toEqual([STORE_MISSING.LOCATION, STORE_MISSING.PRODUCT]);
  });

  it("names only what is still missing", () => {
    expect(store(deriveOnboarding(facts({ locationCount: 1 }))).missing).toEqual([STORE_MISSING.PRODUCT]);
    expect(store(deriveOnboarding(facts({ productsOnSale: 3 }))).missing).toEqual([STORE_MISSING.LOCATION]);
  });

  it("is ready, with nothing missing, once there is a pickup location and a product on sale", () => {
    const entry = store(deriveOnboarding(facts({ locationCount: 1, productsOnSale: 1 })));
    expect(entry.state).toBe(READINESS_STATE.READY);
    expect(entry.missing).toEqual([]);
  });

  it("words what is missing as a thing to do, never as a requirement (spec R5)", () => {
    for (const wording of Object.values(STORE_MISSING)) {
      expect(wording).not.toMatch(/required/i);
    }
  });
});

describe("the other channels", () => {
  it("every channel is listed exactly once, in display order", () => {
    expect(deriveOnboarding(facts()).readiness.map((entry) => entry.channel)).toEqual([...CHANNELS]);
    expect(CHANNELS).toEqual([CHANNEL.STORE, CHANNEL.AMAZON, CHANNEL.FLIPKART, CHANNEL.INSTAGRAM]);
  });

  it("report unknown with an empty missing list, whatever the facts — no rule exists for them yet", () => {
    for (const status of [deriveOnboarding(facts()), deriveOnboarding(everything())]) {
      const others = status.readiness.filter((entry) => entry.channel !== CHANNEL.STORE);
      expect(others).toHaveLength(CHANNELS.length - 1);
      for (const entry of others) {
        expect(entry.state).toBe(READINESS_STATE.UNKNOWN);
        expect(entry.missing).toEqual([]);
      }
    }
  });
});

describe("complete", () => {
  it("is true only when every step is done and the store is ready", () => {
    expect(deriveOnboarding(everything()).complete).toBe(true);
  });

  it("is false while any step is not done, even with a ready store", () => {
    expect(deriveOnboarding(everything()).complete).toBe(true);
    expect(deriveOnboarding({ ...everything(), hasDescription: false }).complete).toBe(false);
    expect(deriveOnboarding({ ...everything(), brandCount: 0, hasDefaults: false }).complete).toBe(false);
  });

  it("is false while the store is not ready, even with every step done", () => {
    expect(deriveOnboarding({ ...everything(), locationCount: 0 }).complete).toBe(false);
    expect(deriveOnboarding({ ...everything(), productsOnSale: 0 }).complete).toBe(false);
  });
});

describe("the card's copy", () => {
  // Spec R5: the word appears on no profile surface. The card shows readiness as things to do.
  it('never says "required"', () => {
    const source = readFileSync(
      join(resolve(__dirname, "../.."), "src/components/org/onboarding-card.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/required/i);
  });
});
