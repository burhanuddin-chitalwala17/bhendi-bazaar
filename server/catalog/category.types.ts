import type { CategoryAccent } from "@prisma/client";
/**
 * Server-side domain types for Category
 *
 * These types are used exclusively on the server-side (services, repositories).
 */

export interface ServerCategory {
  id: string;
  slug: string;
  /** Self-referencing tree; null = root (category-tree TRD). */
  parentId: string | null;
  name: string;
  description: string;
  heroImage: string;
  accent: CategoryAccent;
  order: number;
}

