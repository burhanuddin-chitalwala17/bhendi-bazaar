/**
 * Home's setup list (own-store onboarding D5; Q2, Q3, Q19). Nothing here reads a database:
 * the facts come in and the status comes out, so the rules are tested without one and the service
 * is only a gatherer. Channel readiness left this list (Q4); Channels keeps its own banner.
 */
export const ONBOARDING_STEP = {
  /** Done the moment the shop exists, so a new shop starts at "1 of 5". */
  OPEN: "open",
  PRODUCT: "product",
  ADDRESS: "address",
  /** A logo and a line about the shop. */
  LOOK: "look",
  SHARE: "share",
} as const;
export type OnboardingStep = (typeof ONBOARDING_STEP)[keyof typeof ONBOARDING_STEP];
/** The owner's order (Q19): something live first, then a finished look, then the share. */
export const ONBOARDING_STEPS = Object.values(ONBOARDING_STEP) as readonly OnboardingStep[];

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value);
}

export interface OnboardingFacts {
  productsOnSale: number;
  /** An active location with a street address and a pickup contact. */
  pickupReady: boolean;
  hasLogo: boolean;
  hasTagline: boolean;
  /** The shop has tapped Share or Copy link at least once (Q3). */
  shared: boolean;
  /** "Hide for now", per shop (Q6). */
  hidden: boolean;
}

export interface OnboardingStatus {
  steps: { key: OnboardingStep; done: boolean }[];
  doneCount: number;
  /** The first step not done, in order; null once all are. */
  next: OnboardingStep | null;
  complete: boolean;
  hidden: boolean;
}

export function deriveOnboarding(facts: OnboardingFacts): OnboardingStatus {
  const done: Record<OnboardingStep, boolean> = {
    [ONBOARDING_STEP.OPEN]: true,
    [ONBOARDING_STEP.PRODUCT]: facts.productsOnSale > 0,
    [ONBOARDING_STEP.ADDRESS]: facts.pickupReady,
    [ONBOARDING_STEP.LOOK]: facts.hasLogo && facts.hasTagline,
    [ONBOARDING_STEP.SHARE]: facts.shared,
  };
  const steps = ONBOARDING_STEPS.map((key) => ({ key, done: done[key] }));
  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    doneCount,
    next: steps.find((step) => !step.done)?.key ?? null,
    complete: doneCount === steps.length,
    hidden: facts.hidden,
  };
}
