/**
 * Onboarding is the three screens that already exist, put in sequence (org-profile spec R7,
 * trd D8), plus the readiness each sales channel reports. Nothing here reads a database: the
 * facts come in and the status comes out, so the rules are tested without one and the service
 * is only a gatherer. Readiness for the marketplace channels is the seam listing-schema fills —
 * until it does, they answer "unknown" and never pretend to a rule they do not have (trd D5).
 */
export const ONBOARDING_STEP = {
  /** Done the moment the org exists. */
  OPEN: "open",
  /** The storefront editor: the org has said something public about itself. */
  DESCRIBE: "describe",
  /** The listing context: a brand, or any default a product starts from. */
  SELL: "sell",
} as const;
export type OnboardingStep = (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP];
/** The order the steps are shown in. */
export const ONBOARDING_STEPS = Object.values(ONBOARDING_STEP) as readonly OnboardingStep[];

import { CHANNEL, CHANNELS, isChannel, type Channel } from "@server/shared/channels";

// Re-exported, not re-declared: every caller that already imported the set from this module
// keeps working, and there is still exactly one place the members are written down.
export { CHANNEL, CHANNELS, isChannel, type Channel };

export const READINESS_STATE = {
  READY: "ready",
  NOT_READY: "not-ready",
  /** No rule computes this channel yet; the missing list is empty because nothing is known. */
  UNKNOWN: "unknown",
} as const;
export type ReadinessState = (typeof READINESS_STATE)[keyof typeof READINESS_STATE];

/** What the store still needs, worded as the thing to do next — never as a requirement (spec R5). */
export const STORE_MISSING = {
  LOCATION: "add a pickup location",
  PRODUCT: "add a product",
} as const;
export type StoreMissing = (typeof STORE_MISSING)[keyof typeof STORE_MISSING];

export interface ChannelReadiness {
  channel: Channel;
  state: ReadinessState;
  missing: string[];
}

export interface OnboardingStatus {
  steps: { key: OnboardingStep; done: boolean }[];
  readiness: ChannelReadiness[];
  /** Every step done and the store ready: the card collapses to one line rather than vanishing. */
  complete: boolean;
}

export interface OnboardingFacts {
  hasDescription: boolean;
  brandCount: number;
  hasDefaults: boolean;
  locationCount: number;
  productsOnSale: number;
}

export function deriveOnboarding(facts: OnboardingFacts): OnboardingStatus {
  const done: Record<OnboardingStep, boolean> = {
    [ONBOARDING_STEP.OPEN]: true,
    [ONBOARDING_STEP.DESCRIBE]: facts.hasDescription,
    [ONBOARDING_STEP.SELL]: facts.brandCount > 0 || facts.hasDefaults,
  };
  const steps = ONBOARDING_STEPS.map((key) => ({ key, done: done[key] }));

  const storeMissing: string[] = [];
  if (facts.locationCount === 0) storeMissing.push(STORE_MISSING.LOCATION);
  if (facts.productsOnSale === 0) storeMissing.push(STORE_MISSING.PRODUCT);

  const readiness: ChannelReadiness[] = CHANNELS.map((channel) =>
    channel === CHANNEL.STORE
      ? {
          channel,
          state: storeMissing.length === 0 ? READINESS_STATE.READY : READINESS_STATE.NOT_READY,
          missing: storeMissing,
        }
      : { channel, state: READINESS_STATE.UNKNOWN, missing: [] },
  );

  const storeReady = readiness.some(
    (entry) => entry.channel === CHANNEL.STORE && entry.state === READINESS_STATE.READY,
  );
  return { steps, readiness, complete: steps.every((step) => step.done) && storeReady };
}
