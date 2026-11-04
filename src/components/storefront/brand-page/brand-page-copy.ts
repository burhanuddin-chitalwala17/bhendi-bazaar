/** A shop's brand page words (ADR-0067): its sections, its proof and what each section waits for. */
export const BRAND_PAGE_COPY = {
  overline: "The shop",
  about: (name: string) => `About ${name}`,
  follow: (name: string) => `Follow ${name}`,
  newest: (name: string) => `Newest from ${name}`,
  seeAll: "See all",
  emptyTitle: "Nothing here just yet",
  emptyDescription: (name: string) => `${name} has not listed anything for sale. Come back soon.`,
  proof: "Why buyers trust this shop",
  terms: "This shop's terms",
  returns: "Returns",
  buyersSay: "What buyers say",
  verifiedPurchase: "Verified purchase",
  whatTheySell: "What they sell",
  brandsCarried: "Brands they carry",
  shopNamed: (name: string) => `Shop ${name}`,
  waiting: {
    story: "a few lines about the shop, or the name of the person behind it",
    categories: "a product on sale, so there is a category to show",
    brands: "a second brand — one brand is not a range worth a section",
    buyersSay: "enough published reviews to be worth quoting",
    policies: "your delivery and returns promise",
    social: "a handle on one of the networks we link to",
  },
} as const;

export const STANDING_LABEL_COPY = {
  hero: "The top of the page",
  story: "About the shop",
  categories: "What you sell",
  brands: "Brands you carry",
  buyersSay: "What buyers say",
  newest: "Your newest goods",
  policies: "Delivery and returns",
  social: "Ways to follow you",
} as const;

export const BRAND_SECTION_COPY = {
  overline: "The shop",
  about: (name: string) => `About ${name}`,
  follow: (name: string) => `Follow ${name}`,
} as const;
