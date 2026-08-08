import { z } from "zod";
import { CategoryAccent } from "@prisma/client";
import { optionalNumber } from "./common.schemas";

/**
 * The accepted shape of an admin category payload.
 *
 * Parsed by the route (server authority) and used as the form's resolver, so the
 * rules shown inline are the rules enforced. `slug` is absent deliberately — it is
 * server-generated from the name and then frozen.
 */

// One set of rules, two envelopes: create applies defaults, update must not.
// `.partial()` does not strip `.default()`s (zod v4), so a defaulted field fires
// inside a PATCH and silently rewrites everything the caller didn't mention —
// blanking a description, or detaching a subcategory back to root.
const rules = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().trim().max(1000),
  heroImage: z.string().trim().max(2048),
  accent: z.enum(CategoryAccent),
  order: z.number().int("Order must be a whole number").min(0),
  // "" is what an unselected <select> submits; the tree stores null for "root".
  // Parent existence and acyclicity are server concerns (admin.category.service).
  parentId: z
    .string()
    .trim()
    .nullable()
    .transform((value) => (value ? value : null)),
};

export const categoryFormSchema = z.object({
  name: rules.name,
  // Defaulted rather than optional: the repository requires these, and the schema
  // is the one place that should decide what "unset" means.
  description: rules.description.default(""),
  heroImage: rules.heroImage.default(""),
  accent: rules.accent.default("EMERALD"),
  order: optionalNumber(rules.order),
  parentId: rules.parentId.default(null),
});

export type CategoryFormSchemaInput = z.infer<typeof categoryFormSchema>;

/** For PATCH — same rules where a field is present, absent fields stay absent. */
export const updateCategorySchema = z.object({
  name: rules.name.optional(),
  description: rules.description.optional(),
  heroImage: rules.heroImage.optional(),
  accent: rules.accent.optional(),
  order: optionalNumber(rules.order),
  parentId: rules.parentId.optional(),
});
