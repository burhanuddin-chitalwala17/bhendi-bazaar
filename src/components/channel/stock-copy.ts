/**
 * Every string stock sync, Match locations and Marketplace orders show, as signed off
 * in docs/specs/marketplace-integration/inventory-sync/ux.md. Edit there first.
 */

export const STOCK = {
  title: "Stock sync",
  locationsToMatch: (l: string) => `Match your ${l} locations so stock can be sent.`,
  matchLocations: "Match locations",
  cardOn: "Stock sync on",
  pause: "Pause",
  paused: "Stock sync paused",
  pausedLine: (l: string) => `Sales are still counted here; ${l} keeps its own count. Turn it back on in Channels.`,
  turnBackOn: "Turn back on",
  onToast: (l: string) => `Stock sync on for ${l}.`,
  pausedToast: (l: string) => `Stock sync paused for ${l}.`,
  newLocation: (l: string, name: string, pincode: string | null) => `New ${l} location: ${name}${pincode ? ` ${pincode}` : ""}. Match it to send its stock.`,
  matchIt: "Match it",
  refused: (l: string, n: number) => `${l} turned down ${n} ${n === 1 ? "listing" : "listings"}; their count there stays as it is until the next change.`,
  notAllowed: (l: string) => `${l} doesn't let us send stock yet. Its own count stays as it is.`,
  busy: (l: string) => `Couldn't reach ${l}. We'll keep trying; nothing is lost.`,
  reconnect: (l: string) => `${l} stopped accepting our access. Reconnect on Channels.`,
  goToChannels: "Go to Channels",
  failed: "Couldn't save that. Nothing was changed.",
} as const;

export const LOCATIONS = {
  title: (l: string) => `Match your ${l} locations`,
  hint: (l: string) => `Each ${l} location shows the stock of the location you pick here.`,
  oneTitle: (l: string) => `Match your ${l} location`,
  one: (l: string) => `${l} collects from one address. Which of your locations is it?`,
  useThis: "Use this location",
  save: "Save matches",
  notUsed: "Not used",
  choose: "Choose…",
  pickOne: "Pick one of yours, or Not used",
  suggested: "(suggested)",
  gone: (l: string) => `No longer on ${l}`,
  goneHint: "Nothing is sent to it.",
  closed: (name: string) => `${name} is closed here. Pick another.`,
  saved: "Locations matched.",
  pickFirst: "Pick a location first.",
} as const;

export const PRODUCT_STOCK = {
  sent: (n: number, ago: string) => `Stock ${n} · sent ${ago}`,
  sending: "Stock · sending…",
  held: (l: string) => `Stocked by ${l}`,
  oversold: (l: string) => `Oversold: 1 sold on ${l} with none left. Check the order.`,
  seeOrder: "See order",
} as const;

export const MARKETPLACE_ORDERS = {
  tabStore: "Store orders",
  tabMarketplace: "Marketplace orders",
  empty: "No marketplace orders yet. Sales on Amazon and Flipkart show here.",
  line: (orderId: string, amount: string | null, l: string) => `Order ${orderId}${amount ? ` · ${amount} as ${l} reported` : ""}`,
  oversold: "Oversold",
  locationGuessed: "Taken from your first matched location",
  beforeSync: "Before stock sync",
  unlinked: "Not linked to a product: stock not taken",
  cancelled: "Cancelled",
  showMore: "Show more",
} as const;
