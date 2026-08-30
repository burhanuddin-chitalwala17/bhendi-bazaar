import type { BannerActionVariant } from "@prisma/client";

/**
 * Storefront hero banners for a developer's machine.
 *
 * Deliberately here and not in a data migration: production does not break without
 * them, which is the test CLAUDE.md Invariant 7 sets. They are house copy written
 * during development, so shipping them would put words nobody with authority over the
 * shop had approved on its most prominent surface. A fresh environment starts with an
 * empty hero and the owner writes the first banner.
 *
 * No `order` — the seed assigns it by position, the same way the create route appends.
 */
export const seedBanners: {
  id: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  isActive: boolean;
  actions: { label: string; href: string; variant: BannerActionVariant }[];
}[] = [
  {
    id: "banner_house",
    title: "Royal silhouettes, old-city soul.",
    eyebrow: "Bhendi Bazaar · Islamic Boutique",
    description:
      "From emerald abayas to filigree accents, discover pieces inspired by the lanes, minarets, and balconies of Bhendi Bazaar.",
    imageUrl: null,
    imageAlt: null,
    isActive: true,
    actions: [
      { label: "Shop Abayas", href: "/category/abayas", variant: "PRIMARY" },
      { label: "Browse Attars", href: "/category/attars", variant: "SECONDARY" },
    ],
  },
  {
    id: "banner_abayas",
    title: "Cut for the everyday, finished for the occasion.",
    eyebrow: "The Abaya Edit",
    description:
      "Flowing crepe, hand-set trims, and colours that hold their depth from morning to maghrib.",
    imageUrl: null,
    imageAlt: null,
    isActive: true,
    actions: [{ label: "Shop Abayas", href: "/category/abayas", variant: "PRIMARY" }],
  },
  {
    id: "banner_attars",
    title: "Oud, rose, and musk — undiluted.",
    eyebrow: "Attars & Oils",
    description:
      "Alcohol-free attars pressed in small batches, the way the old shops on the lane still sell them.",
    imageUrl: null,
    imageAlt: null,
    isActive: true,
    actions: [{ label: "Browse Attars", href: "/category/attars", variant: "PRIMARY" }],
  },
];
