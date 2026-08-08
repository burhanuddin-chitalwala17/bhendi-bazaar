import type { CategoryAccent } from "@prisma/client";
/**
 * Client-side domain types for Category
 *
 * These types are used on the client-side (components, hooks).
 */

export interface Category {
  slug: string;
  name: string;
  description: string;
  heroImage: string;
  accent: CategoryAccent;
  order: number;
}


