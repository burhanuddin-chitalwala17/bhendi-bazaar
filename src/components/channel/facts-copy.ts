/**
 * Every string the "Facts from {marketplace}" card, its Choose sheet and the Ask the admin sheet
 * show, as signed off in docs/specs/marketplace-integration/marketplace-facts/ux.md. Edit there first.
 */

const MONTH_MS = 30 * 24 * 60 * 60_000;

export const FACTS = {
  title: (l: string) => `Facts from ${l}`,
  fill: (l: string) => `Fill from ${l}`,
  notRead: (l: string) => `${l}'s answers haven't been read yet.`,
  stillReading: (l: string) => `Still reading ${l}…`,
  partial: (filled: number, toConfirm: number, l: string) =>
    `${filled} ${filled === 1 ? "fact" : "facts"} filled from ${l} · ${toConfirm} to confirm`,
  confirm: (n: number) => `Confirm ${n}`,
  success: (l: string, ago: string) => `All facts filled from ${l}. Read ${ago}.`,
  toConfirm: (l: string, fact: string, said: string) => `${l} says ${fact}: ${said}. Which fits this product?`,
  skip: "Skip for now",
  skipped: "Skipped for now:",
  askAgain: (fact: string) => `Ask ${fact} again`,
  nothingNew: (l: string) => `Nothing new to fill from ${l}: the facts it answers are already filled.`,
  from: (l: string) => `from ${l}`,
  youChose: (l: string) => `from ${l} · you chose`,
  changedByYou: "changed by you",
  was: (said: string, l: string) => `was ${said} from ${l}`,
  edit: "Edit",
  reset: (l: string) => `Reset to ${l}'s answer`,
  typeToConfirm: (l: string, theirs: string) => `${l} lists this as ${theirs}. Which of our types is it?`,
  categoryToConfirm: (l: string, theirs: string, ours: string) => `${l} lists this as ${theirs}, our ${ours}. Which category does it go in?`,
  noMatchingType: (l: string, theirs: string) => `${l} lists this as ${theirs}, which isn't one of our product types. Nothing is filled.`,
  pickOrAsk: "Pick one of ours if it fits, or ask the admin to add one.",
  pickOrPark: "Pick one of ours if it fits, or park it.",
  stale: (l: string, checkedOn: string, now = Date.now()) => {
    const months = Math.max(1, Math.round((now - new Date(checkedOn).getTime()) / MONTH_MS));
    return `Check the mapping: ${l}'s answers for this type were last checked ${months} ${months === 1 ? "month" : "months"} ago.`;
  },
  busy: (l: string) => `Couldn't read ${l}'s answers. ${l} is busy; try again in a few minutes.`,
  reconnect: (l: string) => `${l} stopped accepting our access, so we can't read this listing. Reconnect on Channels.`,
  noType: (l: string) => `This product has no product type, so there are no ${l} facts to fill. Set its category first.`,
  noMapping: (l: string) => `No ${l} mapping yet for this type. Nothing to fill.`,
  noAnswers: (l: string) => `${l} didn't share any answers for this listing, so there's nothing to fill.`,
  chooseOne: "Choose one",
  showAll: "Show all",
  tryAgain: "Try again",
  editProduct: "Edit product",
  goToChannels: "Go to Channels",
} as const;

export const CHOOSE = {
  says: (l: string, fact: string, said: string) => `${l} says ${fact}: ${said}.`,
  which: "Which of these fits?",
  failed: "Couldn't save that answer. Nothing was changed.",
} as const;

export const FACTS_TOAST = {
  filled: (fact: string, l: string) => `${fact} filled from ${l}.`,
  changed: (fact: string, l: string) => `${fact} changed. ${l}'s answer is kept for reference.`,
  reset: (l: string) => `Reset to ${l}'s answer.`,
  parked: "Parked. It's in Left off until a type exists.",
  category: (category: string) => `${category} chosen. Facts are filling.`,
} as const;

export const ASK_ADMIN = {
  action: "Ask the admin",
  whatsapp: "Send by WhatsApp",
  email: "Send by email",
  yourself: "Send it yourself. Nothing is sent without you.",
  parked: "Waiting for a product type. Ask the admin to add one.",
  park: "Park it",
  bringBack: "Bring back",
  subject: "A product type for a marketplace listing",
  message: (shop: string, l: string, title: string, sku: string, theirs: string) =>
    `Hello Bhendi Bazaar, ${shop} needs a product type for an ${l} listing: ${title} (SKU ${sku}). ${l} lists it as ${theirs}. Please add a matching type.`,
} as const;
