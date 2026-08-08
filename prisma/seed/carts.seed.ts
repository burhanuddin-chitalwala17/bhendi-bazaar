/**
 * Seed data for Abandoned Carts
 * Carts that haven't been updated in 7+ days (potential abandoned cart recovery targets)
 */

import type { SeedCart } from "./types";

// Helper to create dates in the past
const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export const seedCarts: SeedCart[] = [
  // Cart abandoned 10 days ago
  {
    id: "cart-1",
    userId: "user-1",
    items: [
      {
        productId: "prod-8",
        productName: "Emerald Stone Necklace",
        productSlug: "emerald-stone-necklace",
        quantity: 1,
        price: 256000,
        thumbnail: "https://placehold.co/800x800/eab308/ffffff?text=Emerald+Necklace",
      },
      {
        productId: "prod-4",
        productName: "Royal Oud Attar",
        productSlug: "royal-oud-attar",
        quantity: 1,
        price: 192000,
        thumbnail: "https://placehold.co/800x800/f59e0b/ffffff?text=Oud+Attar",
      },
    ],
    updatedAt: daysAgo(10),
  },
  
  // Cart abandoned 15 days ago
  {
    id: "cart-2",
    userId: "user-2",
    items: [
      {
        productId: "prod-3",
        productName: "Embroidered Maroon Abaya",
        productSlug: "embroidered-maroon-abaya",
        quantity: 1,
        price: 580000,
        thumbnail: "https://placehold.co/800x800/800020/ffffff?text=Maroon+Abaya",
      },
    ],
    updatedAt: daysAgo(15),
  },
  
  // Cart abandoned 22 days ago
  {
    id: "cart-3",
    userId: "user-3",
    items: [
      {
        productId: "prod-2",
        productName: "Classic Black Jilbab",
        productSlug: "classic-black-jilbab",
        quantity: 1,
        price: 288000,
        thumbnail: "https://placehold.co/800x800/000000/ffffff?text=Black+Jilbab",
      },
      {
        productId: "prod-6",
        productName: "Sandalwood Amber Attar",
        productSlug: "sandalwood-amber-attar",
        quantity: 2,
        price: 153000,
        thumbnail: "https://placehold.co/800x800/f59e0b/ffffff?text=Sandalwood+Amber",
      },
      {
        productId: "prod-11",
        productName: "Wooden Tasbih (99 Beads)",
        productSlug: "wooden-tasbih-99-beads",
        quantity: 1,
        price: 45000,
        thumbnail: "https://placehold.co/800x800/0ea5e9/ffffff?text=Tasbih",
      },
    ],
    updatedAt: daysAgo(22),
  },
];

