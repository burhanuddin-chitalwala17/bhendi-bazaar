import type { IconName } from "@/components/ui/icon";
import type { PlatformMarkName } from "@/components/ui/icons/platform-marks";

/** One flat price per shop, GST included, no tiers and no per-seat (BACKLOG: subscriptions). Display only. */
export const SUBSCRIPTION_MONTHLY_PAISE = 69_900;

/** The owner's stated default on store orders (2026-11-05). Display only — payouts reads `Org.commissionBps`. */
export const STORE_COMMISSION_PERCENT = 2;

/** The two sides of /business, chosen by `?for=` so each audience gets its own link. */
export const AUDIENCE = { SHOP: "shop", PARTNER: "partner" } as const;
export type Audience = (typeof AUDIENCE)[keyof typeof AUDIENCE];

/** Live today, or announced. The owner's call (2026-11-14): show what is coming, labelled as coming. */
export type PlaceStatus = "live" | "soon";

export type SellingPlace = { mark: PlatformMarkName | null; name: string; note: string; status: PlaceStatus };

export type BusinessFeature = { id: "catalogue" | "photos" | "store" | "orders"; label: string; title: string; body: string };

/** Every word on /business, in one place. Plain words: a shopkeeper or a brand manager, not an engineer. */
export const BUSINESS_COPY = {
  meta: {
    title: "Bhendi Bazaar for business — sell with us, or partner with us",
    description:
      "Shops: your own online store, studio-ready photos and Amazon, all from your phone, for ₹699 a month. Brands: put your name where Bhendi Bazaar's buyers arrive.",
  },

  eyebrow: "Bhendi Bazaar for business",
  switchLabel: "Who is this page for",
  tabs: { shop: "Sell with us", partner: "Partner with us" },

  shop: {
    hero: {
      title: "Run your whole shop online,",
      titleEmphasis: "from one place.",
      lead: "Your own online store, studio-ready product photos and your marketplace listings — all from your phone.",
      cta: "Open your shop",
      perMonth: "a month",
      facts: ["GST included", "Cancel any month"],
    },

    problem: {
      label: "Why it exists",
      title: "Selling online shouldn’t",
      titleEmphasis: "take over the shop.",
      today: "Today",
      with: "With Bhendi Bazaar",
      rows: [
        { today: "The same product typed again for every app.", with: "Describe it once. Every place you sell reads it." },
        { today: "Phone photos rejected for the background or the light.", with: "Studio-ready photos in a tap." },
        { today: "The last piece sells in one place and stays up in another.", with: "One stock count. A sale anywhere updates it everywhere." },
        { today: "A catalogue that can’t take a payment or book a courier.", with: "A real store with checkout and delivery booked for you." },
      ],
    },

    everywhere: {
      label: "How it works",
      title: "List once.",
      titleEmphasis: "Sell everywhere.",
      lead: "Add a product once. It goes to your store and to the places your customers already shop — and every order comes back to one screen.",
      product: { name: "Hand bag, dusty rose", price: "₹850", stock: "12 in stock" },
      live: "Live",
      soon: "Coming soon",
      places: [
        { mark: null, name: "Your own store", note: "Your own link to share", status: "live" },
        { mark: "amazon", name: "Amazon", note: "Listings, stock and orders", status: "live" },
        { mark: "google", name: "Google Shopping", note: "Your products in Google search", status: "live" },
        { mark: "meta", name: "Facebook & Instagram shop", note: "Your catalogue, kept up to date", status: "live" },
        { mark: "flipkart", name: "Flipkart", note: "Listings, stock and orders", status: "soon" },
        { mark: "meesho", name: "Meesho", note: "Buyers in every town", status: "soon" },
        { mark: "whatsapp", name: "WhatsApp", note: "Your catalogue in their chats", status: "soon" },
        { mark: "instagram", name: "Instagram posts", note: "Posts, reels and stories", status: "soon" },
      ] satisfies SellingPlace[],
    },

    features: {
      label: "What you get",
      title: "Everything a shop needs",
      titleEmphasis: "to grow online.",
      items: [
        {
          id: "catalogue",
          label: "Add products",
          title: "Describe it once.",
          body: "Snap it on your phone, add hundreds from one sheet, or bring over what you already sell on Amazon.",
        },
        {
          id: "photos",
          label: "Photo studio",
          title: "Phone photo in. Studio photo out.",
          body: "Only the background changes. Your product stays exactly as it is.",
        },
        {
          id: "store",
          label: "Your store",
          title: "A store you’ll be proud to share.",
          body: "Your logo, your colours and your own link. Payments and courier pickup included.",
        },
        {
          id: "orders",
          label: "Orders",
          title: "Mark it packed. We book the courier.",
          body: "Store and marketplace orders in one list, with your earnings on every order.",
        },
      ] satisfies BusinessFeature[],
    },

    coming: {
      label: "Coming soon",
      title: "More places to sell,",
      titleEmphasis: "at no extra cost.",
      lead: "We are adding the platforms India shops on. Each one arrives in your plan the day it is ready — nothing more to pay, nothing to set up again.",
      items: [
        { mark: "flipkart", name: "Flipkart", body: "List, update stock and take orders on one of India’s biggest marketplaces." },
        { mark: "meesho", name: "Meesho", body: "Reach buyers in smaller towns, from the same product you already added." },
        { mark: "whatsapp", name: "WhatsApp", body: "Your catalogue inside the chats your customers already use." },
        { mark: "instagram", name: "Instagram", body: "Turn a product into a post, a reel or a story in a tap." },
      ] satisfies { mark: PlatformMarkName; name: string; body: string }[],
    },

    pricing: {
      label: "Pricing",
      title: "One plan.",
      titleEmphasis: "Everything included.",
      lead: "No tiers to compare and nothing held back. Every shop pays the same.",
      planName: "Bhendi Bazaar for business",
      perMonth: "a month, GST included",
      commission: (percent: number) =>
        `Plus ${percent}% on orders paid through your own store. Nothing on your Amazon sales.`,
      cancel: "Billed monthly. Cancel any month.",
      includesTitle: "Included",
      includes: [
        "Your own store and brand page",
        "Photo studio",
        "Amazon, Google and Facebook & Instagram",
        "Add hundreds of products at once",
        "Orders and courier booking",
        "Offers and coupons",
        "Every new platform as it arrives",
      ],
    },

    steps: {
      label: "Getting started",
      title: "Open today.",
      titleEmphasis: "Sell tonight.",
      items: [
        { title: "Open your shop", body: "Sign in, name your shop and choose your link. A couple of minutes." },
        { title: "Add your products", body: "Snap them, upload a sheet, or bring them over from Amazon." },
        { title: "Share your link", body: "Send it to your customers. Google, Facebook and Amazon bring the rest." },
      ],
    },

    faq: {
      label: "Questions",
      title: "Before you start",
      items: [
        { q: "Is there more than one plan?", a: "No. One plan, every feature, the same price for every shop." },
        {
          q: "What do you charge on sales?",
          a: `${STORE_COMMISSION_PERCENT}% on orders paid through your own Bhendi Bazaar store. Nothing on your Amazon sales.`,
        },
        { q: "Can I cancel?", a: "Yes, any month. You are billed monthly and there is no lock-in." },
        {
          q: "I already sell on Amazon. Do I start again?",
          a: "No. Connect your Amazon account and the products you already sell there come across, matched to yours.",
        },
        {
          q: "When do Flipkart, Meesho, WhatsApp and Instagram arrive?",
          a: "They are on the way. Each one is added to your plan the day it is ready, at no extra cost.",
        },
        {
          q: "Do I need to be good with technology?",
          a: "No. Everything is made for your phone, in plain words. If anything is unclear, talk to us.",
        },
      ],
    },

    closing: {
      title: "Your shop deserves",
      titleEmphasis: "to be found.",
      lead: "Open it today. Share your link tonight.",
      cta: "Open your shop",
    },
  },

  partner: {
    hero: {
      title: "Put your brand",
      titleEmphasis: "where the buyers arrive.",
      lead: "Partner with Bhendi Bazaar and be seen on our home page, our category pages and in every campaign we run — beside the shops changing how India sells online.",
      cta: "Become a partner",
      secondary: "See where you’d appear",
      facts: ["Home page", "Category pages", "Every campaign"],
      brand: "Your brand",
      featured: "Featured partner",
    },

    arrive: {
      label: "Why now",
      title: "India’s shops and shoppers",
      titleEmphasis: "are meeting online.",
      lead: "Buyers come from the apps they already use and land on bhendi-bazaar.com and on each shop’s own store. That is where your brand would be.",
      from: [
        { mark: "google", name: "Google" },
        { mark: "meta", name: "Facebook" },
        { mark: "instagram", name: "Instagram" },
        { mark: "amazon", name: "Amazon" },
        { mark: "whatsapp", name: "WhatsApp" },
      ] satisfies { mark: PlatformMarkName; name: string }[],
      landsOn: "They land on bhendi-bazaar.com",
      siteAlt: "Bhendi Bazaar’s home page",
    },

    placements: {
      label: "Where you’d appear",
      title: "Three places",
      titleEmphasis: "your brand could be.",
      home: {
        title: "Home page banner",
        body: "The first thing every visitor sees.",
        alt: "Bhendi Bazaar’s home page, where a partner banner would sit",
      },
      category: {
        title: "Category pages",
        body: "Be the name on the section your buyers shop in.",
        alt: "The Ridas category page, where a partner banner would sit",
        presents: "presents Ridas",
      },
      campaign: {
        title: "Every campaign we run",
        body: "Your name on our posts, reels and stories.",
        label: "A Bhendi Bazaar post presented by a partner brand",
        presentedBy: "Presented by",
        postTitle: "New this week",
        postBody: "Fresh pieces from the shops of Bhendi Bazaar",
      },
    },

    values: {
      label: "What it says about you",
      title: "Associate with innovation.",
      titleEmphasis: "Be seen supporting growth.",
      items: [
        { icon: "trend", title: "Modern", body: "Be seen beside the platform changing how India sells online." },
        { icon: "shop", title: "Supportive", body: "Stand behind small shops as they grow, one shop at a time." },
        { icon: "show", title: "In front of buyers", body: "On the home page, the category pages and every campaign we run." },
      ] satisfies { icon: IconName; title: string; body: string }[],
    },

    steps: {
      label: "How it works",
      title: "Three steps",
      titleEmphasis: "to go live.",
      items: [
        { title: "Tell us about your brand", body: "On WhatsApp or by message — who you are and who you want to reach." },
        { title: "Choose together", body: "We agree the placements, the dates and the price with you." },
        { title: "Go live", body: "Your brand appears across Bhendi Bazaar on the dates you chose." },
      ],
    },

    faq: {
      label: "Questions",
      title: "Before you reach out",
      items: [
        {
          q: "What does it cost?",
          a: "It depends on where you appear and for how long. Tell us what you have in mind and we will send you a simple quote.",
        },
        { q: "Can I choose the category?", a: "Yes. Pick the categories your buyers shop in, and we will place you there." },
        { q: "Do I need to sell on Bhendi Bazaar?", a: "No. Any brand that wants to reach our buyers can partner with us." },
        { q: "How soon can we go live?", a: "Once we agree the placements and dates, your brand goes live on the first day you chose." },
      ],
    },

    closing: {
      title: "Grow with the shops",
      titleEmphasis: "changing how India sells online.",
      lead: "Tell us about your brand. We reply within a day.",
      cta: "Become a partner",
      times: "×",
      brand: "Your brand",
    },
  },

  mockup: {
    storeLabel: "A shop’s own store on Bhendi Bazaar",
    shopName: "Noor Boutique",
    shopTagline: "Abayas, attars and gifts",
    storeTabs: ["Abayas", "Attars", "Jewellery"],
    products: [
      { name: "Emerald satin abaya", price: "₹3,690" },
      { name: "Sandalwood attar", price: "₹1,530" },
    ],
    addToBag: "Add to bag",
    photoLabel: "A phone photo before and after the photo studio",
    before: "Phone photo",
    after: "Ready for Amazon",
    tools: ["Cut out", "On white", "Studio", "Scene"],
    catalogueLabel: "A sheet of products becoming a catalogue",
    sheetHeader: ["Product", "Price", "Stock"],
    sheetRows: [
      ["Rida, mint", "₹1,500", "6"],
      ["Rida, beige", "₹2,650", "4"],
      ["Abaya, black", "₹3,200", "9"],
      ["Attar, oud", "₹1,250", "12"],
    ],
    addedCount: "128 products added",
    ordersLabel: "The shop’s orders screen",
    needsYou: "Needs you now",
    toPack: "2 orders to pack",
    courierBooked: "Packed · courier booked",
    earned: "Earned this week",
    earnedValue: "₹18,420",
    newOrder: "New order",
    newOrderFrom: "Amazon · ₹850",
    orderLabel: "A new order arriving from Amazon",
    liveOn: "Live on every channel",
    synced: "12 in stock everywhere",
  },
} as const;
