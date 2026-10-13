/**
 * The dev catalogue, shaped like the live one and answered like a real listing.
 *
 * Every fact and measurement below is a key the vocabulary actually permits, checked against the
 * seeded `ListingValue` rows — a seed that invents answers would make the readiness gate agree
 * with nothing and look correct while proving nothing.
 *
 * Three things here exist to make the whole chain reachable on a developer's machine:
 *
 * - **A rida answered in plain `nida`**, which Flipkart has no word for — it lists only "Nida
 *   Matte". That is the unmapped-value worklist with something real in it.
 * - **A masalla bag**, whose type is deliberately not sold on any channel, so the "decided
 *   against" list is not empty either.
 * - **One rida left half-answered**, because a catalogue where everything is complete never
 *   shows what incomplete looks like.
 */

import type { SeedProduct } from "./types";
import { seedOrgs } from "./orgs.seed";

const org = (n: number): string => seedOrgs[n % seedOrgs.length].id;

const img = (colour: string, text: string) =>
  `https://placehold.co/800x800/${colour}/ffffff.png?text=${encodeURIComponent(text)}`;

export const seedProducts: SeedProduct[] = [
  // ── Ridas ────────────────────────────────────────────────────────────────────────────────
  {
    id: "prod-rida-1",
    slug: "black-nida-rida-formal",
    name: "Black Nida Rida — Formal",
    description:
      "An occasion rida in matte nida with worked borders on the pardi. Falls straight without clinging.\n\nCare: dry clean only.",
    price: 420000,
    salePrice: 369000,
    currency: "INR",
    orgId: org(0),
    categoryId: "cat-ridas-formal",
    tags: ["rida", "formal", "nida"],
    flags: ["FEATURED", "HERO"],
    images: [img("111827", "Black Rida 1"), img("111827", "Black Rida 2")],
    thumbnail: img("111827", "Black Rida"),
    // One seeded product carries video so the gallery's mixed case is reachable in dev.
    video: "aqz-KE-bpKQ",
    stock: 12,
    kind: "rida",
    facts: {
      colour: "black",
      material: "nida-matte",
      pattern: "embroidered",
      sleeveLength: "full-sleeves",
      stitchType: "stitched",
      audience: "women",
      occasion: "formal",
      care: "dry-clean-only",
    },
    measurements: { length: 54, bust: 40, waist: 38, hip: 42, shoulder: 15, sleeve: 22 },
  },
  {
    // Answered in plain `nida`, which Flipkart does not list. Readiness reports it and the
    // register's worklist asks the owner once, for every product that shares the answer.
    id: "prod-rida-2",
    slug: "maroon-nida-rida-semi-formal",
    name: "Maroon Nida Rida — Semi-formal",
    description: "A lighter nida rida for a majlis or a visit. Plain pardi, no work.",
    price: 310000,
    currency: "INR",
    orgId: org(0),
    categoryId: "cat-ridas-semi-formal",
    tags: ["rida", "semi-formal"],
    flags: ["FEATURED"],
    images: [img("7f1d1d", "Maroon Rida")],
    thumbnail: img("7f1d1d", "Maroon Rida"),
    stock: 8,
    kind: "rida",
    facts: {
      colour: "maroon",
      material: "nida",
      pattern: "plain",
      sleeveLength: "full-sleeves",
      audience: "women",
      occasion: "casual",
    },
    measurements: { length: 52, bust: 38, waist: 36, hip: 40, shoulder: 14, sleeve: 21 },
  },
  {
    // Deliberately half-answered: no material, no audience. A catalogue where everything is
    // complete never shows what the incomplete band looks like.
    id: "prod-rida-3",
    slug: "cotton-rida-casual",
    name: "Cotton Rida — Casual",
    description: "An everyday cotton rida, cut for wearing all day.",
    price: 185000,
    currency: "INR",
    orgId: org(1),
    categoryId: "cat-ridas-casual",
    tags: ["rida", "casual", "cotton"],
    flags: [],
    images: [img("1e3a5f", "Cotton Rida")],
    thumbnail: img("1e3a5f", "Cotton Rida"),
    stock: 20,
    kind: "rida",
    facts: { colour: "dark-blue", pattern: "plain" },
    measurements: { length: 52, bust: 38 },
  },
  {
    id: "prod-rida-4",
    slug: "ohbat-rida-plain",
    name: "Ohbat Rida — Plain",
    description: "Light and easy to move in, cut for ohbat.",
    price: 165000,
    currency: "INR",
    orgId: org(1),
    categoryId: "cat-ridas-ohbat",
    tags: ["rida", "ohbat"],
    flags: [],
    images: [img("065f46", "Ohbat Rida")],
    thumbnail: img("065f46", "Ohbat Rida"),
    stock: 15,
    kind: "rida",
    facts: {
      colour: "green",
      material: "cotton",
      pattern: "plain",
      sleeveLength: "full-sleeves",
      audience: "women",
      occasion: "casual",
    },
    measurements: { length: 50, bust: 38, waist: 36, hip: 40, shoulder: 14, sleeve: 20 },
  },

  // ── Bags ─────────────────────────────────────────────────────────────────────────────────
  {
    id: "prod-bag-1",
    slug: "structured-handbag-black",
    name: "Structured Handbag — Black",
    description: "A structured handbag with a detachable strap and two compartments.",
    price: 145000,
    salePrice: 119000,
    currency: "INR",
    orgId: org(0),
    categoryId: "cat-hand-bags",
    tags: ["handbag", "black"],
    flags: ["ON_OFFER"],
    images: [img("581c87", "Handbag")],
    thumbnail: img("581c87", "Handbag"),
    stock: 10,
    kind: "handbag",
    facts: {
      colour: "black",
      material: "genuine-leather",
      pattern: "plain",
      closure: "zip",
      strap: "detachable-strap",
      compartments: 2,
      waterResistant: false,
      audience: "women",
      occasion: "formal",
    },
    measurements: { length: 30, width: 12, height: 24 },
  },
  {
    // A sling reaches a different Flipkart node from a handbag, and that node asks different
    // fields — the case the per-node attribute key exists for.
    id: "prod-bag-2",
    slug: "sling-bag-tan",
    name: "Sling Bag — Tan",
    description: "A small cross-body sling for a phone, a purse and keys.",
    price: 89000,
    currency: "INR",
    orgId: org(1),
    categoryId: "cat-hand-bags",
    tags: ["sling", "tan"],
    flags: [],
    images: [img("92400e", "Sling Bag")],
    thumbnail: img("92400e", "Sling Bag"),
    stock: 14,
    kind: "sling",
    facts: {
      colour: "khaki",
      material: "artificial-leather",
      pattern: "plain",
      strap: "non-detachable-strap",
      audience: "women",
      occasion: "casual",
    },
    measurements: { length: 20, width: 7, height: 16 },
  },

  // ── Attar and bakhoor ────────────────────────────────────────────────────────────────────
  {
    id: "prod-attar-1",
    slug: "oud-attar-12ml",
    name: "Oud Attar — 12ml",
    description: "A deep oud attar, oil-based and alcohol-free. Lasts the day on cloth.",
    price: 95000,
    currency: "INR",
    orgId: org(0),
    categoryId: "cat-attars",
    tags: ["attar", "oud"],
    flags: ["FEATURED", "HERO"],
    images: [img("b45309", "Oud Attar")],
    thumbnail: img("b45309", "Oud Attar"),
    stock: 30,
    kind: "attar",
    facts: { scentFamily: "oud", shelfLifeMonths: 36, packQuantity: 1 },
    measurements: { capacity: 12 },
  },
  {
    id: "prod-attar-2",
    slug: "rose-attar-6ml",
    name: "Rose Attar — 6ml",
    description: "Rose attar pressed from petals, light enough for every day.",
    price: 52000,
    currency: "INR",
    orgId: org(0),
    categoryId: "cat-attars",
    tags: ["attar", "rose"],
    flags: [],
    images: [img("be123c", "Rose Attar")],
    thumbnail: img("be123c", "Rose Attar"),
    stock: 25,
    kind: "attar",
    facts: { scentFamily: "rose", shelfLifeMonths: 24, packQuantity: 1 },
    measurements: { capacity: 6 },
  },
  {
    // Bakhoor is the nearest-fit case on both channels: Flipkart has only Incense Bricks, and
    // Google files it under Incense though it is bought as a fragrance.
    id: "prod-bakhoor-1",
    slug: "bakhoor-chips-50g",
    name: "Bakhoor Chips — 50g",
    description: "Scented wood chips for the burner. Sandalwood base with a musk finish.",
    price: 68000,
    currency: "INR",
    orgId: org(1),
    categoryId: "cat-attars",
    tags: ["bakhoor", "sandalwood"],
    flags: ["FEATURED"],
    images: [img("78350f", "Bakhoor")],
    thumbnail: img("78350f", "Bakhoor"),
    stock: 18,
    kind: "bakhoor",
    facts: { scentFamily: "sandalwood", shelfLifeMonths: 48, packQuantity: 1 },
  },

  // ── Masalla bags: the type the owner decided sells here only ─────────────────────────────
  {
    id: "prod-masalla-1",
    slug: "ladies-masalla-bag-maroon",
    name: "Ladies Masalla Bag — Maroon",
    description: "A prayer set in one bag: masalla, topi and tasbih.",
    price: 125000,
    currency: "INR",
    orgId: org(0),
    categoryId: "cat-masalla",
    tags: ["masalla", "prayer", "combo"],
    flags: ["FEATURED"],
    images: [img("9f1239", "Masalla Bag")],
    thumbnail: img("9f1239", "Masalla Bag"),
    stock: 22,
    kind: "masalla-set",
    facts: { contents: "Masalla, topi and tasbih", colour: "maroon", packQuantity: 3 },
  },

  // ── Bottom wear ──────────────────────────────────────────────────────────────────────────
  {
    // A palazzo reaches Flipkart's trouser node with Type = Palazzos, which is an exact match
    // rather than a nearest fit — the second slot a channel gives you.
    id: "prod-bottom-1",
    slug: "black-palazzo",
    name: "Black Palazzo",
    description: "Wide-leg palazzo with an elasticated waist, cut to fall under a rida.",
    price: 72000,
    currency: "INR",
    orgId: org(1),
    categoryId: "cat-bottom-wear",
    tags: ["palazzo", "black"],
    flags: [],
    images: [img("1f2937", "Palazzo")],
    thumbnail: img("1f2937", "Palazzo"),
    stock: 26,
    kind: "palazzo",
    facts: {
      colour: "black",
      material: "crepe",
      pattern: "plain",
      fit: "culottes",
      waistRise: "mid-rise",
      audience: "women",
      occasion: "casual",
    },
    measurements: { length: 38, waist: 30 },
  },

  // ── Jewellery ────────────────────────────────────────────────────────────────────────────
  {
    id: "prod-ring-1",
    slug: "silver-ring-plain",
    name: "Silver Ring — Plain band",
    description: "A plain sterling band, sized to Indian ring sizes.",
    price: 185000,
    currency: "INR",
    orgId: org(0),
    categoryId: "cat-jewellery",
    tags: ["ring", "silver"],
    flags: [],
    images: [img("a16207", "Silver Ring")],
    thumbnail: img("a16207", "Silver Ring"),
    stock: 6,
    kind: "ring",
    facts: {
      colour: "silver",
      plating: "sterling-silver",
      baseMaterial: "sterling-silver",
      purity: "s-925",
      audience: "women",
      occasion: "casual",
    },
    measurements: { diameter: 17 },
  },

  // ── Prayer mats ──────────────────────────────────────────────────────────────────────────
  {
    // On Flipkart this is their `mat` node with Type = Prayer — exact, not a compromise.
    id: "prod-mat-1",
    slug: "velvet-janamaz-green",
    name: "Velvet Janamaz — Green",
    description: "A cotton-velvet janamaz with a woven mihrab, padded enough to kneel on.",
    price: 98000,
    currency: "INR",
    orgId: org(1),
    categoryId: "cat-prayer-mats",
    tags: ["janamaz", "prayer-mat"],
    flags: ["FEATURED"],
    images: [img("166534", "Janamaz")],
    thumbnail: img("166534", "Janamaz"),
    stock: 16,
    kind: "mat",
    facts: {
      colour: "green",
      material: "velvet",
      pattern: "embroidered",
      shape: "rectangular",
      packQuantity: 1,
    },
    measurements: { length: 110, width: 65 },
  },
];
