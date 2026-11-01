import { ONBOARDING_STEP, type OnboardingStep } from "@server/catalog/org-onboarding.types";
import { PORTAL_NAV } from "./portal-nav";

/**
 * Every hint card and the "?" answer for each page (own-store onboarding D9), beside PORTAL_NAV,
 * whose purpose lines "?" repeats. A hint has 1–3 cards of at most two sentences (own-store Q12).
 */
export const HINT_COPY = {
  next: "Next",
  gotIt: "Got it",
  close: "Close",
  pageHelp: "What is this page for?",
  position: (index: number, total: number) => `${index} of ${total}`,
} as const;

const PRODUCT = ["Photos sell. Use daylight and a plain wall.", "Price and stock. You can change them any time."] as const;
const ADDRESS = ["Couriers pick up from here. Buyers never see it."] as const;
const LOOK = ["Your logo and one line show at the top of your shop page."] as const;
const SHARE = ["Send your link to customers on WhatsApp. They can order without calling you."] as const;

export interface StepHint {
  cards: readonly string[];
  /** The last card's button, which starts the task. */
  action: string;
}

/** Null for "Your shop is open", which is ticked at creation and has nothing to do. */
export const STEP_HINT: Record<OnboardingStep, StepHint | null> = {
  [ONBOARDING_STEP.OPEN]: null,
  [ONBOARDING_STEP.PRODUCT]: { cards: PRODUCT, action: "Add product" },
  [ONBOARDING_STEP.ADDRESS]: { cards: ADDRESS, action: "Add pickup address" },
  [ONBOARDING_STEP.LOOK]: { cards: LOOK, action: "Add logo and line" },
  [ONBOARDING_STEP.SHARE]: { cards: SHARE, action: "Share your shop" },
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
