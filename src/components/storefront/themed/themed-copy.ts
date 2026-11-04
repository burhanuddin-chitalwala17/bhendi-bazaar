/** A themed shop's words (ADR-0067): its chrome, its sections and its product card. */
export const THEMED_COPY = {
  aboutThisShop: "About this shop",
  sections: {
    deals: "Deals",
    shopTheDeal: "Shop the deal",
    onOffer: "On offer",
    bestSelling: "Best selling",
    newIn: "New in",
    whyBuy: "Why buy from us",
    shopClaims: "What the shop says",
    visit: "Visit & contact",
    contactUs: "Contact us",
    story: "Our story",
    reviews: "What buyers say",
    shopByCategory: "Shop by category",
    explore: "Explore",
  },
  card: {
    soldOut: "Sold out",
    inAuction: "In an auction",
  },
  tabs: {
    region: "Shop",
    home: "Home",
    shop: "Shop",
    deals: "Deals",
    cart: "Cart",
    more: "More",
  },
  more: {
    account: "Account",
    login: "Login",
    orders: "Orders",
    shopAll: (appName: string) => `Shop all of ${appName}`,
  },
  footer: {
    shop: "Shop",
    deals: "Deals",
    contactUs: "Contact us",
  },
  cartLink: (count: number) => (count > 0 ? `Cart, ${count} items` : "Cart"),
} as const;

export const VISIT_COPY = {
  short: "Visit shop",
  named: (name: string) => `Visit ${name}`,
} as const;
