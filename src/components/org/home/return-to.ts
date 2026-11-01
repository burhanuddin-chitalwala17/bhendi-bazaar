import { ONBOARDING_STEP, isOnboardingStep, type OnboardingStep } from "@server/catalog/org-onboarding.types";

/**
 * Where a task goes when it is saved (own-store onboarding D8). `from` arrives in the URL, so it is
 * matched against this set and never read as a path: a crafted link cannot become a redirect.
 */
export const RETURN_TO = { HOME: "home" } as const;
export type ReturnTo = (typeof RETURN_TO)[keyof typeof RETURN_TO];

export function parseReturnTo(value: unknown): ReturnTo | null {
  return value === RETURN_TO.HOME ? RETURN_TO.HOME : null;
}

export function parseDoneStep(value: unknown): OnboardingStep | null {
  return isOnboardingStep(value) ? value : null;
}

export function homeAfter(orgId: string, step: OnboardingStep): string {
  return `/org/${orgId}?done=${step}`;
}

/** Home's path after `step`, or null when the task was not opened from Home. */
export function returnHref(orgId: string, from: unknown, step: OnboardingStep): string | null {
  return parseReturnTo(from) === RETURN_TO.HOME ? homeAfter(orgId, step) : null;
}

const TASK: Record<OnboardingStep, ((orgId: string) => string) | null> = {
  [ONBOARDING_STEP.OPEN]: null,
  [ONBOARDING_STEP.PRODUCT]: (orgId) => `/org/${orgId}/products/new?from=${RETURN_TO.HOME}`,
  [ONBOARDING_STEP.ADDRESS]: (orgId) => `/org/${orgId}/locations?from=${RETURN_TO.HOME}`,
  [ONBOARDING_STEP.LOOK]: (orgId) => `/org/${orgId}/shop/details?from=${RETURN_TO.HOME}`,
  // The Shop tab holds the link and Share; the share sheet arrives with onboarding unit 6.
  [ONBOARDING_STEP.SHARE]: (orgId) => `/org/${orgId}/shop`,
};

/** Where a setup step's task lives, carrying `from=home` when its save should come back. */
export function taskHref(orgId: string, step: OnboardingStep): string | null {
  return TASK[step]?.(orgId) ?? null;
}
