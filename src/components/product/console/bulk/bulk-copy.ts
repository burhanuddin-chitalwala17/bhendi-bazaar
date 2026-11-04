import { BULK_ACTION, type BulkAction } from "@server/catalog/product-bulk.types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const products = (n: number) => plural(n, "product", "products");

/** The bulk actions' words: plain, sentence case, what happened and why (design-system Q29). */
export const BULK_COPY = {
  title: {
    [BULK_ACTION.PRICE]: (n: number) => `Change the price of ${products(n)}`,
    [BULK_ACTION.STOCK]: (n: number) => `Set stock for ${products(n)}`,
    [BULK_ACTION.ARCHIVE]: (n: number) => `Archive ${products(n)}?`,
    [BULK_ACTION.SEND]: (n: number) => `Send ${products(n)} to a marketplace`,
  } satisfies Record<BulkAction, (n: number) => string>,
  submit: {
    [BULK_ACTION.PRICE]: "Change prices",
    [BULK_ACTION.STOCK]: "Save stock",
    [BULK_ACTION.ARCHIVE]: "Archive",
    [BULK_ACTION.SEND]: "Send",
  } satisfies Record<BulkAction, string>,
  updated: {
    [BULK_ACTION.PRICE]: (n: number) => `${plural(n, "price", "prices")} changed`,
    [BULK_ACTION.STOCK]: (n: number) => `${plural(n, "stock count", "stock counts")} saved`,
    [BULK_ACTION.ARCHIVE]: (n: number) => `${products(n)} archived`,
    [BULK_ACTION.SEND]: (n: number) => `${products(n)} on their way`,
  } satisfies Record<BulkAction, (n: number) => string>,
  actionLabel: {
    [BULK_ACTION.PRICE]: "Price",
    [BULK_ACTION.STOCK]: "Stock",
    [BULK_ACTION.ARCHIVE]: "Archive",
    [BULK_ACTION.SEND]: "Send to marketplace",
  } satisfies Record<BulkAction, string>,
  noun: "selected",
  howLabel: "How to change the price",
  directionLabel: "Raise or lower",
  raise: "Raise",
  lower: "Lower",
  rupeesLabel: "Amount in ₹",
  percentLabel: "Percentage",
  archiveBody: "They leave your shop at once. Orders and history stay, and you can restore any of them later.",
  channelLabel: "Marketplace",
  sendHint: "Sends each product's latest details and stock to its listing there.",
  connectFirst: "Connect a marketplace first, under Channels.",
  noLocations: "Add a pickup address first, so stock has somewhere to be.",
  wholeNumbers: "Stock is a whole number, 0 or more.",
  nothingChanged: "Nothing changed yet. Edit a number, then save.",
  reasonLabel: "Why (the shop will read this)",
  reasonHint: "One line is enough.",
  reasonNeeded: "Say why: the shop reads it beside the change.",
  cancel: "Cancel",
  done: "Done",
  review: "Review",
  aProduct: "A product",
  conflictsTitle: "Someone changed these while you were editing — review",
  conflictLine: (place: string, seen: number, now: number) => `${place ? `${place}: ` : ""}you saw ${seen}, now ${now}`,
  skippedTitle: (n: number) => `${products(n)} left as they were`,
} as const;
