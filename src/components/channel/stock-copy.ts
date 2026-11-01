/**
 * Every string the stock sync section, Match locations and the turn-on preview show, as signed off
 * in docs/specs/marketplace-integration/inventory-sync/ux.md. Edit there first.
 */

export const STOCK = {
  title: "Stock sync",
  off: (l: string) => `Stock sync is off. ${l} keeps its own count.`,
  turnOn: "Turn on stock sync",
  locationsToMatch: (l: string) => `Match your ${l} locations before stock can be sent.`,
  readingLocations: (l: string) => `Reading your ${l} locations… refresh in a minute to match them.`,
  matchLocations: "Match locations",
  on: "Stock sync on",
  onLine: (sent: string | null, checked: string | null) =>
    [sent ? `Sent ${sent}` : null, checked ? `checked ${checked}` : null].filter(Boolean).join(" · ") || "Nothing sent yet",
  pause: "Pause",
  paused: "Stock sync paused",
  pausedLine: (l: string) => `Sales are still counted here; ${l} keeps its own count.`,
  turnBackOn: "Turn back on",
  corrected: (n: number, first: string) => `Today's check put ${n} ${n === 1 ? "count" : "counts"} back: ${first}`,
  correctedOne: (title: string, theirs: number, ours: number) => `${title} (showed ${theirs}, now ${ours})`,
  seeAll: "See all",
  newLocation: (l: string, name: string, pincode: string | null) => `New ${l} location: ${name}${pincode ? ` ${pincode}` : ""}. Match it to send its stock.`,
  matchIt: "Match it",
  sending: (l: string, sent: number, total: number) => `Checking your ${l} counts… ${sent} of ${total} done; only the ones that differ are sent.`,
  refused: (l: string, n: number) => `${l} turned down ${n} ${n === 1 ? "listing" : "listings"}; their count there stays as it is until the next change.`,
  notAllowed: (l: string) => `${l} doesn't let us send stock yet. Its own count stays as it is.`,
  busy: (l: string) => `Couldn't reach ${l}. We'll keep trying; nothing is lost.`,
  reconnect: (l: string) => `${l} stopped accepting our access. Reconnect on Channels.`,
  goToChannels: "Go to Channels",
  allHeld: (l: string) => `All your ${l} listings are stocked by ${l}, so there's nothing to send.`,
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

export const PREVIEW = {
  title: "Turn on stock sync",
  subtitle: (l: string) => `${l} · nothing is sent until you confirm`,
  summary: (changing: number, matching: number) =>
    `${changing} ${changing === 1 ? "listing" : "listings"} will change; ${matching} already match.`,
  none: (n: number) => `All ${n} listings already match. Turn on to keep them that way.`,
  row: (l: string, theirs: number | null, ours: number) => `${l} ${theirs ?? "?"} → ${ours}`,
  archived: "archived",
  held: (l: string) => `stocked by ${l}`,
  send: (l: string) => `Send stock to ${l}`,
  notNow: "Not now",
  reading: (l: string) => `Reading ${l}'s counts…`,
  stillReading: (l: string) => `Still reading ${l}…`,
  unread: (n: number, l: string) => `${n} couldn't be read from ${l} now; they get our count when sync starts.`,
  showAll: "Show all",
  sent: (l: string) => `Stock sync on for ${l}.`,
  pausedToast: (l: string) => `Stock sync paused for ${l}.`,
  matchFirst: "Match your locations before stock can be sent.",
  matchFirstHint: (l: string) => `Each ${l} pickup address gets the stock of the location you pick. Until then there's no count of ours to compare.`,
  toZero: (n: number, l: string) => `${n} ${n === 1 ? "listing" : "listings"} will show out of stock on ${l}: we have 0 for ${n === 1 ? "it" : "them"}. Check ${n === 1 ? "its" : "their"} stock first if that's not right.`,
  outOfStock: "goes out of stock",
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
