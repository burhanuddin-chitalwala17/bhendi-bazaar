/** A public bidding page's words (ADR-0067). */
export const BID_PAGE_COPY = {
  currentlyAt: (amount: string) => `Currently at ${amount}`,
  openingAt: (amount: string) => `Opening at ${amount}`,
  liveDescription: (price: string, when: string) => `${price} · bidding closes ${when}`,
  opensDescription: (when: string) => `Bidding opens ${when}`,
  closedDescription: "Bidding has closed on this item.",
  metaTitle: (name: string) => `${name} — live bidding`,
  live: "Live bidding",
  soon: "Bidding soon",
  closed: "Bidding closed",
  shareTitle: (name: string, app: string) => `${name} — bidding on ${app}`,
  shareText: (name: string) => `Bidding is open on ${name}`,
  usually: (amount: string) => `Usually ${amount}`,
  opensLabel: "Bidding opens",
  openingBid: (amount: string) => `Opening bid ${amount}. Come back then — or share this link with someone who will want it.`,
  opensIn: "Opens in",
  closedLabel: "Bidding has closed",
  soldFor: (amount: string) => `Sold for ${amount}`,
  finishedAt: (amount: string) => `Finished at ${amount}`,
  noBids: "This one closed without any bids.",
  calledOff: "This event was called off.",
  bidsPlaced: (n: number) => `${n} bid${n === 1 ? "" : "s"} were placed.`,
  seeInShop: "See this item in the shop",
  howItWorks: "The highest bidder is contacted directly once bidding closes. Bids are binding offers; who is leading is never shown, only the amount.",
} as const;

/** opengraph-image.tsx: the share card's words. */
export const BID_SHARE_IMAGE_COPY = {
  alt: "Live bidding",
  live: "LIVE BIDDING",
  opensSoon: "BIDDING OPENS SOON",
  closed: "BIDDING CLOSED",
  soldFor: "Sold for",
  currentBid: "Current bid",
  openingBid: "Opening bid",
  opens: "Opens",
  closes: "Closes",
} as const;
