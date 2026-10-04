/**
 * The dev catalogue's categories, shaped like the live one.
 *
 * They mirror the real shop deliberately: **four rida categories sharing one product type** is
 * the case that proves a browsing category is not a question set — formal, semi-formal, casual
 * and ohbat ask identical questions and a buyer shops them separately
 * ([categories](../../docs/specs/listing-vocabulary/categories/) D1a).
 *
 * Each names its `productType`, because the migration that assigned them live was keyed on the
 * live slugs. Without that here, a seeded category asks nothing and the listing vocabulary looks
 * broken on a developer's machine while working perfectly in production.
 */

import type { SeedCategory } from "./types";

const hero = (colour: string, text: string) =>
  `https://placehold.co/1200x600/${colour}/ffffff.png?text=${encodeURIComponent(text)}`;

export const seedCategories: SeedCategory[] = [
  {
    id: "cat-ridas",
    slug: "ridas",
    name: "Ridas",
    description:
      "The two-piece worn by Dawoodi Bohra women — a pardi and a lehenga, in everything from everyday cottons to occasion silks with ghat work.",
    heroImage: hero("10b981", "Ridas"),
    accent: "EMERALD",
    order: 1,
    productType: "islamic-wear",
  },
  // The four below declare no type of their own and inherit islamic-wear from the parent. That
  // inheritance is the thing worth having in dev: it is what `resolveProductType` walks.
  {
    id: "cat-ridas-formal",
    slug: "formal-ridas",
    name: "Formal",
    description: "Occasion ridas — heavier silks, ghat work, worked borders.",
    heroImage: hero("047857", "Formal Ridas"),
    accent: "EMERALD",
    order: 1,
    parentId: "cat-ridas",
  },
  {
    id: "cat-ridas-semi-formal",
    slug: "semi-formal-ridas",
    name: "Semi-formal",
    description: "For a majlis or a visit — lighter than occasion wear, dressier than everyday.",
    heroImage: hero("059669", "Semi-formal Ridas"),
    accent: "EMERALD",
    order: 2,
    parentId: "cat-ridas",
  },
  {
    id: "cat-ridas-casual",
    slug: "casual-ridas",
    name: "Casual",
    description: "Everyday cottons and blends, cut for wearing all day.",
    heroImage: hero("34d399", "Casual Ridas"),
    accent: "EMERALD",
    order: 3,
    parentId: "cat-ridas",
  },
  {
    id: "cat-ridas-ohbat",
    slug: "ohbat-ridas",
    name: "Ohbat",
    description: "Worn for ohbat — plain, light, and easy to move in.",
    heroImage: hero("6ee7b7", "Ohbat Ridas"),
    accent: "EMERALD",
    order: 4,
    parentId: "cat-ridas",
  },
  {
    id: "cat-hand-bags",
    slug: "hand-bags",
    name: "Hand bags",
    description:
      "Handbags, slings and totes carried with a rida — structured enough for a majlis, roomy enough for a day out.",
    heroImage: hero("7c3aed", "Hand bags"),
    accent: "PURPLE",
    order: 2,
    productType: "bag",
  },
  {
    id: "cat-attars",
    slug: "bukhoor-and-attar",
    name: "Bukhoor & attar",
    description:
      "Oil-based attars and bakhoor chips from the lanes of Bhendi Bazaar — oud, musk, rose and sandal, none of it alcohol-based.",
    heroImage: hero("f59e0b", "Bukhoor %26 Attar"),
    accent: "ORANGE",
    order: 3,
    productType: "fragrance",
  },
  {
    id: "cat-masalla",
    slug: "ladies-masalla-bag",
    name: "Ladies masalla bag",
    description:
      "A prayer set in one bag — masalla, topi and tasbih together. Sold here only; no marketplace has a category for a combination.",
    heroImage: hero("be123c", "Masalla bags"),
    accent: "PINK",
    order: 4,
    productType: "combo",
  },
  {
    id: "cat-bottom-wear",
    slug: "bottom-wear",
    name: "Bottom wear",
    description: "Trousers, palazzos and salwars cut to wear under a rida or on their own.",
    heroImage: hero("0284c7", "Bottom wear"),
    accent: "BLUE",
    order: 5,
    productType: "trousers",
  },
  {
    id: "cat-jewellery",
    slug: "jwellery",
    name: "Jewellery",
    description: "Rings and ring sets in silver and plated finishes, sized to Indian standards.",
    heroImage: hero("a16207", "Jewellery"),
    accent: "YELLOW",
    order: 6,
    productType: "jewellery",
  },
  {
    id: "cat-prayer-mats",
    slug: "prayer-essentials",
    name: "Prayer essentials",
    description: "Janamaz and prayer carpets, in cotton velvet and woven blends.",
    heroImage: hero("4f46e5", "Prayer essentials"),
    accent: "BLUE",
    order: 7,
    productType: "prayer-mat",
  },
];
