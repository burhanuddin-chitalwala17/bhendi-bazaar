/** The admin's photo-enhancement page (ADR-0067). */
export const ADMIN_ENHANCEMENTS_COPY = {
  title: "Enhancements",
  description: "What a shop may improve in a month, and what the platform will spend in a day.",
  platformTitle: "The platform’s numbers",
  configured: "Changing these takes effect on the next request — no deploy.",
  unconfigured: "Nothing has been saved yet, so these are the numbers the code falls back to. Saving makes them the platform's.",
  spentToday: "Spent today:",
  of: "of",
  capReached: " — enhancement is stopped for every shop until tomorrow.",
  shopsTitle: "Shops this month",
  noShops: "No shop has improved a photo this month, and none has a rule of its own.",
  paused: "Paused",
  used: "Used",
  usedOf: (used: number, allowance: number) => `${used} of ${allowance}`,
  ownRule: " · its own",
  cost: "Cost",
} as const;
