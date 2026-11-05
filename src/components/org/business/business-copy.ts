import type { IconName } from "@/components/ui/icon";
import type { PlatformMarkName } from "@/components/ui/icons/platform-marks";

/** One flat price per shop, GST included, no tiers and no per-seat (BACKLOG: subscriptions). Display only. */
export const SUBSCRIPTION_MONTHLY_PAISE = 69_900;

/** The owner's stated default on store orders (2026-11-05). Display only — payouts reads `Org.commissionBps`. */
export const STORE_COMMISSION_PERCENT = 2;

export type BusinessFeature = {
  id: string;
  label: string;
  title: string;
  body: string;
  points: readonly string[];
};

export type BusinessChannel = { mark: PlatformMarkName | null; name: string; note: string };

/** Every word on /business, in one place, ready to translate (own-store: plain words). */
export const BUSINESS_COPY = {
  meta: {
    title: "Bhendi Bazaar for business — your shop, online everywhere",
    description:
      "Your own online store, phone photos made marketplace-ready, and your Amazon and Flipkart listings and stock in one place. ₹699 a month, GST included.",
  },

  nav: { cta: "Open your shop" },

  hero: {
    label: "For shops and brands",
    title: "Run your whole shop online, from one place.",
    lead: "Bhendi Bazaar gives your shop its own online store, turns phone photos into marketplace-ready pictures, and keeps your Amazon and Flipkart listings and stock in step — all from your phone.",
    primary: "Open your shop",
    secondary: "See how it works",
    proof: ["GST included", "Cancel any month", "Made in Mumbai"],
    perMonth: "a month",
  },

  before: {
    label: "Why it exists",
    title: "Selling online shouldn’t take over the shop.",
    lead: "Most shopkeepers we meet do the same work three times and still lose sales. Here is what changes.",
    today: "Today",
    with: "With Bhendi Bazaar",
    rows: [
      {
        today: "The same product typed into Amazon, Flipkart and a WhatsApp catalogue.",
        with: "Describe it once. Every channel reads that one entry.",
      },
      {
        today: "Phone photos rejected for the background, the size or the light.",
        with: "Cut out, on white or in a scene, sized for each platform in a tap.",
      },
      {
        today: "The last piece sells on one marketplace and stays live on another.",
        with: "One stock count. A sale anywhere updates it everywhere.",
      },
      {
        today: "A catalogue on WhatsApp that can’t take a payment or book a courier.",
        with: "A real store at your own link, with checkout and delivery booked for you.",
      },
    ],
  },

  hub: {
    label: "How it works",
    title: "One product in. Every place you sell, out.",
    lead: "You add a product once — its photos, price, sizes and stock. Bhendi Bazaar carries it to your store and to the platforms your customers already use, and brings their orders back to one screen.",
    product: { name: "Emerald satin abaya", price: "₹3,690", stock: "12 in stock" },
    stockNote: "One stock count, shared by every channel",
    channels: [
      { mark: null, name: "Your store", note: "Your own link" },
      { mark: "amazon", name: "Amazon", note: "Listings, stock, orders" },
      { mark: "flipkart", name: "Flipkart", note: "Listings, stock, orders" },
      { mark: "google", name: "Google Shopping", note: "Automatic feed" },
      { mark: "meta", name: "Facebook & Instagram", note: "Automatic catalogue" },
    ] satisfies BusinessChannel[],
  },

  features: [
    {
      id: "store",
      label: "Your own store",
      title: "A store you’re proud to hand out.",
      body: "Your shop gets its own address — ready for WhatsApp, your visiting card and the pamphlet on the counter. It looks like your brand, not like ours.",
      points: [
        "Themes, your logo and a brand page that tells your story",
        "Checkout, payments and courier pickup built in",
        "Offers, coupons and timed auctions for one-of-a-kind pieces",
        "Stock kept per shop and godown",
      ],
    },
    {
      id: "photos",
      label: "Photos made ready",
      title: "Phone photo in. Studio photo out.",
      body: "Take the picture in the shop. Remove the background, put it on white, in a studio or in a scene — then keep it or throw it away.",
      points: [
        "The product itself is never altered, only what is around it",
        "Every photo and short video in one library",
        "Guided capture for the angles marketplaces ask for",
      ],
    },
    {
      id: "everywhere",
      label: "Sell everywhere",
      title: "Your Amazon and Flipkart, finally in one place.",
      body: "Connect your Amazon and Flipkart accounts and every listing you already have arrives in one inbox, matched to your products. From then on you manage them here.",
      points: [
        "One stock count across your store, Amazon and Flipkart",
        "Publish to Amazon, update price and stock on Flipkart",
        "Google Shopping and Facebook and Instagram catalogues, automatic",
        "Add hundreds of products at once from a sheet",
      ],
    },
    {
      id: "business",
      label: "Run the business",
      title: "Know what to do next, every morning.",
      body: "Your home screen says what needs you now — orders to pack, stock running low — and what you have earned.",
      points: [
        "Store and marketplace orders side by side",
        "Mark a parcel packed; we book the courier",
        "Earnings order by order, and what is still to come",
        "Reviews, and the products customers are saving",
      ],
    },
  ] satisfies BusinessFeature[],

  strengths: {
    label: "Why shops choose us",
    title: "Built for the way a shop really works.",
    items: [
      { icon: "phone", title: "Made for your phone", body: "Every screen is designed for the phone in your hand first, then the laptop." },
      { icon: "message", title: "Plain words", body: "“Money you’ll receive”, not “ledger”. If you use WhatsApp, you can run this." },
      { icon: "photo", title: "Your photos stay true", body: "Enhancement changes the background, never the product. Buyers get what they saw." },
      { icon: "info", title: "Warns, never blocks", body: "If Amazon may reject a listing, we tell you why — the choice stays yours." },
      { icon: "shop", title: "Your brand, your customers", body: "Your store carries your name, your colours and your story." },
      { icon: "connect", title: "Made for Indian marketplaces", body: "Amazon.in and Flipkart built in, with GST-ready prices and Indian couriers." },
    ] satisfies { icon: IconName; title: string; body: string }[],
  },

  pricing: {
    label: "Pricing",
    title: "One plan. Every feature. No surprises.",
    lead: "No tiers to compare and nothing held back. Every shop pays the same.",
    planName: "Bhendi Bazaar for business",
    perMonth: "per month, GST included",
    commission: (percent: number) =>
      `Plus ${percent}% on orders paid through your Bhendi Bazaar store. Nothing on your Amazon or Flipkart sales.`,
    cancel: "Billed monthly. Cancel any month.",
    cta: "Open your shop",
    includesTitle: "Everything included",
    includes: [
      "Your own store, themes and brand page",
      "Photo enhancement and media library",
      "Amazon and Flipkart: import, publish, stock",
      "Google and Meta catalogues",
      "Bulk upload and variants",
      "Orders, delivery booking and earnings",
      "Offers, coupons and auctions",
      "Every new feature as it ships",
    ],
    soonTitle: "Arriving in your plan",
    soon: ["Sales by channel", "Instagram posts"],
  },

  steps: {
    label: "Getting started",
    title: "Open today. Sell tonight.",
    items: [
      { title: "Open your shop", body: "Sign in, name your shop and choose your link. A couple of minutes." },
      { title: "Add your products", body: "Snap them on your phone, upload a sheet, or import from Amazon and Flipkart." },
      { title: "Share your link", body: "Send it to your customers. Google, Meta and the marketplaces bring the rest." },
    ],
  },

  faq: {
    label: "Questions",
    title: "Before you start",
    items: [
      {
        q: "Are there other plans?",
        a: "No. One plan with every feature, at the same price for every shop.",
      },
      {
        q: "What do you charge on sales?",
        a: `${STORE_COMMISSION_PERCENT}% on orders paid through your Bhendi Bazaar store, which covers the payment and the platform. Nothing on sales made on Amazon or Flipkart — those are between you and them.`,
      },
      {
        q: "Can I cancel?",
        a: "Yes, any month. You are billed monthly and there is no lock-in.",
      },
      {
        q: "I already sell on Amazon or Flipkart. Do I start again?",
        a: "No. Connect your marketplace account and your existing listings arrive in one inbox, matched to your products by SKU.",
      },
      {
        q: "I don’t sell on any marketplace yet.",
        a: "Start with your own store and the Google and Meta catalogues. Connect a marketplace whenever you are ready.",
      },
      {
        q: "Do I need to be good with technology?",
        a: "No. Everything is built for a phone, in plain words. If something is unclear, you can reach us directly.",
      },
    ],
  },

  closing: {
    title: "Your shop deserves to be found.",
    lead: "Open it today, share your link tonight.",
    cta: "Open your shop",
    contact: "Questions? Talk to us",
  },

  mockup: {
    storeLabel: "A shop’s own store on Bhendi Bazaar",
    shopName: "Noor Boutique",
    shopTagline: "Abayas, attars and gifts from Bhendi Bazaar",
    storeTabs: ["Abayas", "Attars", "Jewellery"],
    products: [
      { name: "Emerald satin abaya", price: "₹3,690" },
      { name: "Sandalwood amber attar", price: "₹1,530" },
    ],
    photoLabel: "A phone photo before and after enhancement",
    before: "Phone photo",
    after: "Ready for Amazon",
    tools: ["Cut out", "On white", "Studio", "Scene"],
    channelsLabel: "One product listed on every channel",
    live: "Live",
    liveOn: "Live on every channel",
    addToBag: "Add to bag",
    synced: "12 in stock everywhere",
    ordersLabel: "The shop’s home screen",
    needsYou: "Needs you now",
    toPack: "2 orders to pack",
    lowStock: "1 product running low",
    earned: "Earned this week",
    earnedValue: "₹18,420",
    markPacked: "Mark packed",
  },
} as const;
