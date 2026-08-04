/**
 * Server-side domain types for Category
 *
 * These types are used exclusively on the server-side (services, repositories).
 */

export interface ServerCategory {
  slug: string;
  name: string;
  description: string;
  heroImage: string;
  accentColorClass: string;
  order: number;
}

