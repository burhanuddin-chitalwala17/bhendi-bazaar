/**
 * Seed data for Products
 * Note: image URLs will need to be updated after uploading to Vercel Blob
 */

import type { SeedProduct } from "./types";
import { seedOrgs } from "./orgs.seed";

// Helper function to randomly assign a org
const getRandomOrg = (): string => {
  const randomIndex = Math.floor(Math.random() * seedOrgs.length);
  return seedOrgs[randomIndex].id;
};

export const seedProducts: SeedProduct[] = [
  // ABAYAS CATEGORY (3 products)
  {
    id: "prod-1",
    slug: "emerald-satin-abaya",
    name: "Emerald Satin Abaya",
    description:
      "Luxurious satin cotton abaya in rich emerald green. Features elegant draping and a comfortable fit perfect for both everyday wear and special occasions. Comes with authentic Kutchhi belt detailing.\n\nCare: First wash dry cleaning recommended. No machine wash.",
    price: 4200,
    salePrice: 3690,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-abayas",
    tags: ["abaya", "evening", "satin", "emerald", "special-occasion"],
    flags: ["FEATURED", "HERO", "ON_OFFER"],
    rating: 0,
    reviewsCount: 0,
    images: [
      "https://placehold.co/800x800/10b981/ffffff?text=Emerald+Abaya+1",
      "https://placehold.co/800x800/10b981/ffffff?text=Emerald+Abaya+2",
    ],
    thumbnail: "https://placehold.co/800x800/10b981/ffffff?text=Emerald+Abaya",
    sizes: ["S", "M", "L", "XL"],
    colors: ["Emerald Green", "Deep Teal"],
    stock: 45,
    sku: "ABY-EMR-001",
    lowStockThreshold: 10,
    weight: 0.4, // ⭐ Clothing weight
  },
  {
    id: "prod-2",
    slug: "classic-black-jilbab",
    name: "Classic Black Jilbab",
    description:
      "Timeless black jilbab with fluid drape and minimalist design. Perfect for everyday comfort in the old city. Made from breathable fabric that keeps you cool in Mumbai's climate.",
    price: 3200,
    salePrice: 2880,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-abayas",
    tags: ["jilbab", "everyday", "black", "classic", "breathable"],
    flags: ["ON_OFFER"],
    rating: 0,
    reviewsCount: 0,
    images: ["https://placehold.co/800x800/000000/ffffff?text=Black+Jilbab"],
    thumbnail: "https://placehold.co/800x800/000000/ffffff?text=Black+Jilbab",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: ["Jet Black"],
    stock: 28,
    sku: "JIL-BLK-001",
    lowStockThreshold: 10,
    weight: 0.35, // ⭐ Lighter fabric
  },
  {
    id: "prod-3",
    slug: "embroidered-maroon-abaya",
    name: "Embroidered Maroon Abaya",
    description:
      "Stunning maroon abaya with intricate gold thread embroidery on the sleeves and hem. A statement piece that combines tradition with contemporary style. Perfect for weddings and festive occasions.",
    price: 5800,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-abayas",
    tags: ["abaya", "embroidered", "maroon", "wedding", "festive"],
    flags: ["FEATURED"],
    rating: 0,
    reviewsCount: 0,
    images: [
      "https://placehold.co/800x800/800020/ffffff?text=Maroon+Abaya+1",
      "https://placehold.co/800x800/800020/ffffff?text=Maroon+Abaya+2",
    ],
    thumbnail: "https://placehold.co/800x800/800020/ffffff?text=Maroon+Abaya",
    sizes: ["M", "L", "XL"],
    colors: ["Maroon", "Burgundy"],
    stock: 12,
    sku: "ABY-MAR-001",
    lowStockThreshold: 10,
    weight: 0.5, // ⭐ Heavier due to embroidery
  },

  // ATTARS CATEGORY (3 products)
  {
    id: "prod-4",
    slug: "royal-oud-attar",
    name: "Royal Oud Attar",
    description:
      "Premium oud attar from the finest agarwood. Deep, woody fragrance with hints of musk and amber. Long-lasting scent that evolves throughout the day. Alcohol-free and skin-safe.\n\nSize: 12ml concentrated oil",
    price: 2400,
    salePrice: 1920,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-attars",
    tags: ["attar", "oud", "woody", "premium", "long-lasting"],
    flags: ["FEATURED", "HERO", "ON_OFFER"],
    rating: 0,
    reviewsCount: 0,
    images: ["https://placehold.co/800x800/f59e0b/ffffff?text=Oud+Attar"],
    thumbnail: "https://placehold.co/800x800/f59e0b/ffffff?text=Oud+Attar",
    sizes: ["12ml"],
    colors: ["Golden"],
    stock: 65,
    sku: "ATT-OUD-001",
    lowStockThreshold: 15,
    weight: 0.05, // ⭐ Small perfume bottle
  },
  {
    id: "prod-5",
    slug: "rose-musk-blend",
    name: "Rose & Musk Blend",
    description:
      "Delicate blend of Bulgarian rose and white musk. Floral yet sophisticated fragrance perfect for daily wear. Gentle on skin and suitable for all occasions.",
    price: 1200,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-attars",
    tags: ["attar", "rose", "musk", "floral", "everyday"],
    flags: [],
    rating: 0,
    reviewsCount: 0,
    images: ["https://placehold.co/800x800/f59e0b/ffffff?text=Rose+Musk"],
    thumbnail: "https://placehold.co/800x800/f59e0b/ffffff?text=Rose+Musk",
    sizes: ["8ml", "12ml"],
    colors: ["Rose Gold"],
    stock: 0,
    sku: "ATT-RSM-001",
    lowStockThreshold: 10,
    weight: 0.04, // ⭐ Small perfume bottle
  },
  {
    id: "prod-6",
    slug: "sandalwood-amber-attar",
    name: "Sandalwood Amber Attar",
    description:
      "Warm and inviting blend of sandalwood and amber. Traditional fragrance with modern refinement. Perfect for evening wear and special occasions.",
    price: 1800,
    salePrice: 1530,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-attars",
    tags: ["attar", "sandalwood", "amber", "warm", "evening"],
    flags: ["ON_OFFER"],
    rating: 0,
    reviewsCount: 0,
    images: [
      "https://placehold.co/800x800/f59e0b/ffffff?text=Sandalwood+Amber",
    ],
    thumbnail:
      "https://placehold.co/800x800/f59e0b/ffffff?text=Sandalwood+Amber",
    sizes: ["12ml"],
    colors: ["Amber"],
    stock: 38,
    sku: "ATT-SAN-001",
    lowStockThreshold: 10,
    weight: 0.05, // ⭐ Small perfume bottle
  },

  // JEWELLERY CATEGORY (3 products)
  {
    id: "prod-7",
    slug: "gold-filigree-earrings",
    name: "Gold Filigree Earrings",
    description:
      "Exquisite gold-toned filigree earrings featuring intricate traditional patterns. Lightweight despite their elaborate design. Perfect for weddings and festive celebrations.\n\nMaterial: Gold-plated brass with anti-tarnish coating",
    price: 1500,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-jewellery",
    tags: ["earrings", "gold", "filigree", "traditional", "wedding"],
    flags: ["FEATURED"],
    rating: 0,
    reviewsCount: 0,
    images: [
      "https://placehold.co/800x800/eab308/ffffff?text=Gold+Earrings+1",
      "https://placehold.co/800x800/eab308/ffffff?text=Gold+Earrings+2",
    ],
    thumbnail: "https://placehold.co/800x800/eab308/ffffff?text=Gold+Earrings",
    sizes: ["One Size"],
    colors: ["Gold"],
    stock: 22,
    sku: "JWL-EAR-001",
    lowStockThreshold: 8,
    weight: 0.02, // ⭐ Very light jewelry
  },
  {
    id: "prod-8",
    slug: "emerald-stone-necklace",
    name: "Emerald Stone Necklace",
    description:
      "Statement necklace adorned with emerald-green stones and gold detailing. Contemporary design inspired by Mughal jewelry. Adjustable chain length.",
    price: 3200,
    salePrice: 2560,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-jewellery",
    tags: ["necklace", "emerald", "statement", "contemporary", "stones"],
    flags: ["FEATURED", "ON_OFFER"],
    rating: 0,
    reviewsCount: 0,
    images: [
      "https://placehold.co/800x800/eab308/ffffff?text=Emerald+Necklace",
    ],
    thumbnail:
      "https://placehold.co/800x800/eab308/ffffff?text=Emerald+Necklace",
    sizes: ["Adjustable"],
    colors: ["Gold & Emerald"],
    stock: 8,
    sku: "JWL-NCK-001",
    lowStockThreshold: 10,
    weight: 0.08, // ⭐ Heavier with stones
  },
  {
    id: "prod-9",
    slug: "pearl-jhumka-set",
    name: "Pearl Jhumka Set",
    description:
      "Classic jhumka earrings with pearl drops. Traditional design that never goes out of style. Comes with matching tikka. Perfect for traditional attire.",
    price: 2200,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-jewellery",
    tags: ["jhumka", "pearls", "traditional", "set", "classic"],
    flags: [],
    rating: 0,
    reviewsCount: 0,
    images: ["https://placehold.co/800x800/eab308/ffffff?text=Pearl+Jhumka"],
    thumbnail: "https://placehold.co/800x800/eab308/ffffff?text=Pearl+Jhumka",
    sizes: ["One Size"],
    colors: ["Gold & Pearl"],
    stock: 5,
    sku: "JWL-JHM-001",
    lowStockThreshold: 8,
    weight: 0.03, // ⭐ Light jewelry set
  },

  // PRAYER ESSENTIALS CATEGORY (3 products)
  {
    id: "prod-10",
    slug: "velvet-prayer-mat",
    name: "Velvet Prayer Mat",
    description:
      "Premium velvet prayer mat with cushioned base for comfort during long prayers. Features beautiful Kaaba design. Includes matching carry bag for travel.\n\nSize: 110cm x 70cm",
    price: 1800,
    salePrice: 1440,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-prayer",
    tags: ["prayer-mat", "velvet", "travel", "cushioned", "kaaba"],
    flags: ["FEATURED", "ON_OFFER"],
    rating: 0,
    reviewsCount: 0,
    images: [
      "https://placehold.co/800x800/0ea5e9/ffffff?text=Prayer+Mat+1",
      "https://placehold.co/800x800/0ea5e9/ffffff?text=Prayer+Mat+2",
    ],
    thumbnail: "https://placehold.co/800x800/0ea5e9/ffffff?text=Prayer+Mat",
    sizes: ["110x70cm"],
    colors: ["Emerald", "Maroon", "Navy Blue"],
    stock: 42,
    sku: "PRY-MAT-001",
    lowStockThreshold: 10,
    weight: 0.6, // ⭐ Prayer mat with cushioning
  },
  {
    id: "prod-11",
    slug: "wooden-tasbih-99-beads",
    name: "Wooden Tasbih (99 Beads)",
    description:
      "Handcrafted tasbih made from premium sandalwood. 99 beads with divider markers. Smooth finish and pleasant natural fragrance. Comes in decorative box.",
    price: 450,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-prayer",
    tags: ["tasbih", "wooden", "sandalwood", "99-beads", "handcrafted"],
    flags: [],
    rating: 0,
    reviewsCount: 0,
    images: ["https://placehold.co/800x800/0ea5e9/ffffff?text=Tasbih"],
    thumbnail: "https://placehold.co/800x800/0ea5e9/ffffff?text=Tasbih",
    sizes: ["Standard"],
    colors: ["Natural Wood", "Dark Brown"],
    stock: 78,
    sku: "PRY-TSB-001",
    lowStockThreshold: 20,
    weight: 0.03, // ⭐ Wooden beads
  },
  {
    id: "prod-12",
    slug: "quran-cover-embroidered",
    name: "Embroidered Quran Cover",
    description:
      "Protective Quran cover with beautiful gold embroidery. Soft padded interior to protect your holy book. Zipper closure for secure storage.\n\nFits standard Quran sizes (25cm x 18cm)",
    price: 650,
    currency: "INR",
    orgId: getRandomOrg(),
    categoryId: "cat-prayer",
    tags: ["quran-cover", "embroidered", "protective", "zipper"],
    flags: [],
    rating: 0,
    reviewsCount: 0,
    images: ["https://placehold.co/800x800/0ea5e9/ffffff?text=Quran+Cover"],
    thumbnail: "https://placehold.co/800x800/0ea5e9/ffffff?text=Quran+Cover",
    sizes: ["Standard", "Large"],
    colors: ["Green", "Maroon", "Navy"],
    stock: 33,
    sku: "PRY-QCR-001",
    lowStockThreshold: 15,
    weight: 0.15, // ⭐ Padded fabric cover
  },
];