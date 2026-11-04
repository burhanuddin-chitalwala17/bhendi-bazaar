/** The shop's "Money you'll receive" page (ADR-0067). */
export const EARNINGS_COPY = {
  title: "Money you'll receive",
  description: "What you earned and when it's paid",
  owed: "You are owed",
  unclaimed: (amount: string) => `${amount} not yet in a settlement`,
  orders: "Orders",
  empty: "Nothing yet — your first sale will appear here.",
  adjustment: "adjustment",
  goods: "Goods sold, at list",
  yourOffer: "Your offer",
  commission: "Commission",
  youReceive: "You receive",
  platformFunded: (paid: string, funded: string) =>
    `Buyers paid ${paid} — the platform funded ${funded} of discount on your goods. Your credit is unaffected.`,
  payments: "Payments to you",
  paidOn: (date: string) => `Paid ${date}`,
  rates: "Your commission rates",
  defaultRate: "Default",
} as const;
