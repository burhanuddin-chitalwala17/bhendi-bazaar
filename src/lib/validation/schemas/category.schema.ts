import { z } from "zod";

/**
 * The accepted shape of an admin category payload.
 *
 * Parsed by the route (server authority) and used as the form's resolver, so the
 * rules shown inline are the rules enforced. `slug` is absent deliberately — it is
 * server-generated from the name and then frozen.
 */
export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  // Defaulted rather than optional: the repository requires these, and the schema
  // is the one place that should decide what "unset" means.
  description: z.string().trim().max(1000).default(""),
  heroImage: z.string().trim().max(2048).default(""),
  accentColorClass: z.string().trim().max(100).default("bg-emerald-50"),
  order: z.number().int("Order must be a whole number").min(0).optional(),
});

export type CategoryFormSchemaInput = z.infer<typeof categoryFormSchema>;

/** Partial for PATCH — every field optional, same rules where present. */
export const updateCategorySchema = categoryFormSchema.partial();
