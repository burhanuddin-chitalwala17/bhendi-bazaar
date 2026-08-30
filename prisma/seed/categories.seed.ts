/**
 * Seed data for Categories
 * Note: heroImage URLs will need to be updated after uploading images to Vercel Blob
 */

import type { SeedCategory } from "./types";

export const seedCategories: SeedCategory[] = [
  {
    id: "cat-abayas",
    slug: "abayas",
    name: "Abayas & Jilbabs",
    description:
      "Flowing silhouettes in deep emeralds, maroons, and midnight blacks. Elegant modest wear crafted from premium fabrics for everyday grace and special occasions.",
    heroImage: "https://placehold.co/1200x600/10b981/ffffff.png?text=Abayas+%26+Jilbabs", // Placeholder
    accent: "EMERALD",
    order: 1,
  },
  {
    id: "cat-attars",
    slug: "attars",
    name: "Attars & Scents",
    description:
      "Oil-based fragrances inspired by the lanes of Bhendi Bazaar. Traditional attar perfumes blended with oud, musk, rose, and sandalwood for a lasting impression.",
    heroImage: "https://placehold.co/1200x600/f59e0b/ffffff.png?text=Attars+%26+Scents", // Placeholder
    accent: "ORANGE",
    order: 2,
  },
  {
    id: "cat-jewellery",
    slug: "jewellery",
    name: "Jewellery",
    description:
      "Filigree, stones, and gold-toned details for elevated evenings. Handcrafted traditional and contemporary jewelry pieces that celebrate timeless elegance.",
    heroImage: "https://placehold.co/1200x600/eab308/ffffff.png?text=Jewellery", // Placeholder
    accent: "YELLOW",
    order: 3,
  },
  {
    id: "cat-prayer",
    slug: "prayer-essentials",
    name: "Prayer Essentials",
    description:
      "Prayer mats, tasbihs, and accessories for sacred routines. Quality prayer essentials to enhance your spiritual practice and daily devotion.",
    heroImage: "https://placehold.co/1200x600/0ea5e9/ffffff.png?text=Prayer+Essentials", // Placeholder
    accent: "BLUE",
    order: 4,
  },
];

