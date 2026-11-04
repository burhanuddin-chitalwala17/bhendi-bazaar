import { ONBOARDING_STEP, ONBOARDING_STEPS, type OnboardingStep } from "@server/catalog/org-onboarding.types";

/** Home's words (own-store onboarding ux.md copy deck and Home state matrix). */
export const HOME_COPY = {
  welcome: (name: string) => `Welcome, ${name}. Five steps to your first sale.`,
  allCaughtUp: "All clear. Nothing needs you right now.",
  shopLink: "Your shop link",
  addProduct: "Add a product",
  shareShop: "Share your shop",
  needsYou: "Needs you now",
  lineFailed: "Couldn't load this. Try again.",
  ordersFailed: "Couldn't load orders.",
  tryAgain: "Try again",
  retry: "Retry",
  numbersBeforeFirstOrder: "Your numbers start with your first order.",
  updated: (minutes: number) => `Updated ${minutes} min ago`,
  refresh: "Refresh",
  setupTitle: (n: number) => `Set up your shop · ${n} of ${ONBOARDING_STEPS.length} done`,
  hide: "Hide for now",
  show: "Show",
  setUp: "Your shop is set up.",
  seeYourShop: "See your shop",
  hidden: "Hidden. It stays on Home as one line, to show again.",
  undo: "Undo",
  setupFailed: "Couldn't load your setup list.",
  loading: "Loading your shop",
  loadingSales: "Loading sales",
} as const;

export const STEP_TITLE: Record<OnboardingStep, string> = {
  [ONBOARDING_STEP.OPEN]: "Your shop is open",
  [ONBOARDING_STEP.PRODUCT]: "Add your first product",
  [ONBOARDING_STEP.ADDRESS]: "Add a pickup address",
  [ONBOARDING_STEP.LOOK]: "Add your logo and a line about your shop",
  [ONBOARDING_STEP.SHARE]: "Share your shop link",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "5 h" under a day, "2 days" from one; never "0 h". */
export function waited(ms: number): string {
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return hours < 24 ? `${hours} h` : plural(Math.floor(hours / 24), "day", "days");
}

export const LINE_COPY = {
  toPack: (n: number, waitedMs: number) => `${plural(n, "order", "orders")} to pack · oldest waiting ${waited(waitedMs)}`,
  lowStock: (n: number, soldOut: number, soonestDays: number | null) => {
    const what = `${plural(n, "selling product", "selling products")} low on stock`;
    if (soldOut > 0) return `${what} · ${soldOut} sold out`;
    if (soonestDays === null) return what;
    return soonestDays === 0 ? `${what} · runs out today` : `${what} · runs out in about ${plural(soonestDays, "day", "days")}`;
  },
  reconnect: (label: string) => `${label} needs you to reconnect`,
  renew: (label: string) => `${label} needs you to renew access`,
  matchLocations: (label: string) => `Match your ${label} locations so stock can be sent`,
  outOfStock: (label: string, n: number) => `${plural(n, "listing", "listings")} now out of stock on ${label}: we have 0`,
  photos: (n: number) => `${plural(n, "photo", "photos")} can be improved`,
  teamEdits: (n: number) => `Our team changed ${plural(n, "product", "products")}`,
} as const;

/** The toast after a task opened from Home is saved (R7): the step ticked, and said so. */
export function doneToast(step: OnboardingStep, doneCount: number): string {
  const count = `${doneCount} of ${ONBOARDING_STEPS.length} done`;
  switch (step) {
    case ONBOARDING_STEP.OPEN:
      return "Your shop is open";
    case ONBOARDING_STEP.PRODUCT:
      return `Product added · ${count}`;
    case ONBOARDING_STEP.ADDRESS:
      return `Pickup address added · ${count}`;
    case ONBOARDING_STEP.SHARE:
      return `Shared · ${count}`;
    case ONBOARDING_STEP.LOOK:
      return count;
  }
}
