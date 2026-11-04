import { ONBOARDING_STEP, isOnboardingStep, type OnboardingStep } from "@server/catalog/org-onboarding.types";
import { ROUTES } from "@server/shared/routes";

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
  return `${ROUTES.org.home(orgId)}?done=${step}`;
}

/** Home's path after `step`, or null when the task was not opened from Home. */
export function returnHref(orgId: string, from: unknown, step: OnboardingStep): string | null {
  return parseReturnTo(from) === RETURN_TO.HOME ? homeAfter(orgId, step) : null;
}

const TASK: Record<OnboardingStep, ((orgId: string) => string) | null> = {
  [ONBOARDING_STEP.OPEN]: null,
  [ONBOARDING_STEP.PRODUCT]: (orgId) => `${ROUTES.org.newProduct(orgId)}?from=${RETURN_TO.HOME}`,
  [ONBOARDING_STEP.ADDRESS]: (orgId) => `${ROUTES.org.locations(orgId)}?from=${RETURN_TO.HOME}`,
  [ONBOARDING_STEP.LOOK]: (orgId) => `${ROUTES.org.shopDetails(orgId)}?from=${RETURN_TO.HOME}`,
  // Home opens the share sheet in place (D13); the Shop tab is the way when Home could not read the link.
  [ONBOARDING_STEP.SHARE]: (orgId) => ROUTES.org.shop(orgId),
};

/** Where a setup step's task lives, carrying `from=home` when its save should come back. */
export function taskHref(orgId: string, step: OnboardingStep): string | null {
  return TASK[step]?.(orgId) ?? null;
}
