import type { CategoryAccent } from "@prisma/client";
/**
 * Client-side domain types for Category
 *
 * These types are used on the client-side (components, hooks).
 */

export interface Category {
  id: string;
  slug: string;
  /** Self-referencing tree; null = root. Lane rows are built from it server-side. */
  parentId: string | null;
  name: string;
  description: string;
  heroImage: string;
  accent: CategoryAccent;
  order: number;
}


