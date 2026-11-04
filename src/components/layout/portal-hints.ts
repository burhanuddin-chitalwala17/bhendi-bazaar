import { ONBOARDING_STEP, type OnboardingStep } from "@server/catalog/org-onboarding.types";
import { PORTAL_NAV } from "./portal-nav";
import { PORTAL_HINT_CARDS_COPY } from "@/components/layout/portal-copy";
export { HINT_COPY } from "@/components/layout/portal-copy";


const PRODUCT = [PORTAL_HINT_CARDS_COPY.productPhotos, PORTAL_HINT_CARDS_COPY.productPrice] as const;
const ADDRESS = [PORTAL_HINT_CARDS_COPY.address] as const;
const LOOK = [PORTAL_HINT_CARDS_COPY.look] as const;
const SHARE = [PORTAL_HINT_CARDS_COPY.share] as const;

export interface StepHint {
  cards: readonly string[];
  /** The last card's button, which starts the task. */
  action: string;
}

/** Null for "Your shop is open", which is ticked at creation and has nothing to do. */
export const STEP_HINT: Record<OnboardingStep, StepHint | null> = {
  [ONBOARDING_STEP.OPEN]: null,
  [ONBOARDING_STEP.PRODUCT]: { cards: PRODUCT, action: PORTAL_HINT_CARDS_COPY.productAction },
  [ONBOARDING_STEP.ADDRESS]: { cards: ADDRESS, action: PORTAL_HINT_CARDS_COPY.addressAction },
  [ONBOARDING_STEP.LOOK]: { cards: LOOK, action: PORTAL_HINT_CARDS_COPY.lookAction },
  [ONBOARDING_STEP.SHARE]: { cards: SHARE, action: PORTAL_HINT_CARDS_COPY.shareAction },
};

/** A page's own cards after its purpose line, keyed by its PORTAL_NAV item: a step's page repeats the step's hint. */
export const PAGE_HINT_CARDS: Partial<Record<string, readonly string[]>> = {
  products: PRODUCT,
  locations: ADDRESS,
  details: LOOK,
  shop: SHARE,
};

export interface PageHelpContent {
  title: string;
  purpose: string;
  cards: readonly string[];
}

/** What "?" says on the page a navigation item opens, or null for a key PORTAL_NAV does not hold. */
export function pageHelp(key: string): PageHelpContent | null {
  const entry = PORTAL_NAV.find((item) => item.key === key);
  if (!entry) return null;
  return { title: entry.label, purpose: entry.purpose, cards: PAGE_HINT_CARDS[key] ?? [] };
}
