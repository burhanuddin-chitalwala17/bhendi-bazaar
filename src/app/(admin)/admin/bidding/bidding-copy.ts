/** The admin's auction pages (ADR-0067). */
export const ADMIN_BIDDING_COPY = {
  title: "Auctions",
  description: (awaiting: number) =>
    awaiting > 0
      ? `${awaiting} closed ${awaiting === 1 ? "auction needs" : "auctions need"} an outcome. Until one is recorded, the item stays off sale.`
      : "Every auction across the platform.",
  back: "Auctions",
  copyLink: "Copy public link",
  usually: "Usually",
  openedAt: "Opened at",
  soldFor: "Sold for",
  highest: "Highest",
  none: "—",
  bids: "Bids",
  note: (reason: string) => `Note: ${reason}`,
  bidders: "Bidders, highest first",
  stillRunning: "Bidding is still running — an outcome can be recorded once it closes.",
} as const;
