/** The admin's channel register pages (ADR-0067). */
const products = (n: number) => `${n} ${n === 1 ? "product" : "products"}`;

export const ADMIN_CHANNELS_COPY = {
  title: "Channels",
  description: "What each place calls the things this shop sells, and what is still unmapped. Nothing here publishes; it is the dictionary publishing will read.",
  mapped: (n: number) => `${n} mappings recorded`,
  toDo: (n: number) => (n > 0 ? `${n} to decide` : "Nothing to decide"),
} as const;

export const ADMIN_CHANNEL_COPY = {
  description: (c: { categories: number; attributes: number; values: number }) =>
    `${c.categories} categories, ${c.attributes} fields and ${c.values} answers mapped. Nothing here publishes.`,
  unmappedTitle: "Answers with no word here",
  unmappedBody: "Only what products actually answer. One decision clears every product using that value — and changes it for them all, so a correction works the same way.",
  allMapped: (label: string) => `Every answer this catalogue gives has a word on ${label}.`,
  nowhereTitle: "Products with nowhere to go",
  nowhereBody: (label: string) => `These types sell here but no category on ${label} has been chosen for them.`,
  products,
  notSoldTitle: (label: string) => `Not sold on ${label}`,
  notSoldBody: "Decided, not overlooked — so they stay off the list above. Change your mind here and they go back to it, with the choice still to make.",
  storeOnly: (n: number) => `${products(n)}, sold on this store only`,
  nearestTitle: "Listed as the nearest they have",
  nearestBody: "Not work to do — decisions already taken. Every product they affect shows the note below, every time.",
} as const;
