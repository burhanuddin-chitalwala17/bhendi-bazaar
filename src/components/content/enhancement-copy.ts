/** Photo enhancement's admin words (ADR-0067): the platform's settings and one shop's policy. */
export const ENHANCEMENT_COPY = {
  save: "Save",
  saving: "Saving…",
  settings: {
    saved: "Saved",
    monthlyAllowance: "Enhancements per shop each month",
    monthlyAllowanceHint: "What a shop gets unless it has a number of its own",
    dailyCap: "Daily spend cap (₹)",
    dailyCapHint: "Enhancement stops for everyone once the day's runs have cost this much",
  },
  policy: {
    saved: (orgName: string) => `Saved for ${orgName}`,
    allowance: "Allowance for this shop",
    allowanceHint: (platformDefault: number) => `Leave empty to follow the platform's ${platformDefault}`,
    paused: "Paused",
    pauseFor: (orgName: string) => `Pause enhancement for ${orgName}`,
    pausedOn: "Its members cannot enhance",
    pausedOff: "Enhancement is on",
    reason: "Reason its members will read",
    reasonPlaceholder: "e.g. Unpaid invoice",
  },
} as const;
