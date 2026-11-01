import {
  BadgePercent,
  Camera,
  type LucideIcon,
  Send,
  Store,
} from "lucide-react";

/** One flat price per shop, GST included, no tiers and no per-seat (BACKLOG: subscriptions). Display only. */
export const SUBSCRIPTION_MONTHLY_PAISE = 69_900;

export type SellPillar = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  points: readonly string[];
};

/** Every word on /sell, in one place, ready to translate (own-store: plain words). */
export const SELL_COPY = {
  meta: {
    title: "Sell with Bhendi Bazaar",
    description:
      "Your own store, marketplace-ready photos, and Amazon, Flipkart, Google and Meta from one phone. ₹699 a month, everything included.",
  },

  hero: {
    eyebrow: "For shops and sellers",
    title: "Your shop.",
    titleAccent: "Online everywhere.",
    lead: "Your own store, studio-grade photos and every marketplace — run from the phone in your hand.",
    primary: "Open your shop",
    secondary: "What’s included",
    perMonth: "/month",
    taxNote: "GST included · one plan · every feature",
  },

  suite: {
    eyebrow: "One subscription",
    title: "Everything a shop needs to sell online.",
  },

  pillars: [
    {
      icon: Store,
      eyebrow: "Your own store",
      title: "A store you’re proud to hand out.",
      points: [
        "Your own link for WhatsApp, cards and pamphlets",
        "Themes and a brand page in your colours",
        "Stock kept per shop and godown",
      ],
    },
    {
      icon: Camera,
      eyebrow: "Photos made ready",
      title: "Phone photo in. Studio photo out.",
      points: [
        "Cut out, white, studio or scene in one tap",
        "Your product’s pixels never altered",
        "Guided capture for every angle",
      ],
    },
    {
      icon: Send,
      eyebrow: "Sell everywhere",
      title: "List once. Sell on five platforms.",
      points: [
        "Connect Amazon and Flipkart, import your catalogue",
        "Google Shopping and Meta feeds, automatic",
        "Bulk upload hundreds of products by sheet",
      ],
    },
    {
      icon: BadgePercent,
      eyebrow: "Run the business",
      title: "Orders, offers and earnings, handled.",
      points: [
        "Orders tracked to the customer’s door",
        "Offers, coupons and timed auctions",
        "Earnings, reviews and what customers save",
      ],
    },
  ] satisfies SellPillar[],

  soon: {
    label: "Arriving in your plan",
    items: [
      "One stock count across marketplaces",
      "Publish to Amazon and Flipkart",
      "Sales by channel",
      "Instagram posts",
    ],
  },

  steps: {
    eyebrow: "How it works",
    items: [
      { title: "Open", body: "Name your shop, pick your link." },
      { title: "Add", body: "Snap, upload a sheet or import." },
      { title: "Share", body: "Send your link. Start selling." },
    ],
  },

  pricing: {
    eyebrow: "Pricing",
    title: "One plan. Nothing held back.",
    planName: "Bhendi Bazaar for sellers",
    perMonth: "per month",
    taxNote: "GST included · billed monthly",
    cta: "Open your shop",
    includes: [
      "Store, themes and brand page",
      "Photo enhancement and library",
      "Amazon and Flipkart import",
      "Google and Meta feeds",
      "Bulk upload and variants",
      "Orders, offers and auctions",
      "Earnings and reviews",
      "Every new feature as it ships",
    ],
  },

  faq: {
    eyebrow: "Questions",
    items: [
      {
        q: "Are there other plans?",
        a: "No. One plan, every feature, the same price for every shop.",
      },
      {
        q: "I already sell on Amazon or Flipkart.",
        a: "Connect your seller account and your listings arrive in one inbox, matched to your products by SKU.",
      },
      {
        q: "Do I need to be good with technology?",
        a: "No. Every screen is built for a phone, in plain words. If you use WhatsApp, you can run your shop here.",
      },
    ],
  },
} as const;
