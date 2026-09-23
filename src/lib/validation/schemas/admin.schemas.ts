import { z } from "zod";
import { platformRoleSchema } from "./common.schemas";

// Bodies for the platform-admin write paths. Invariant 4: a route parses, it never
// casts — `as UpdateUserInput` on `await request.json()` is a compile-time fiction with
// no runtime effect, and these three handlers relied on it.
//
// Each whitelists its fields, so nothing else in a body reaches a Prisma `data`
// argument. `platformRole` is deliberately writable here and nowhere else: this is the
// one screen that grants it.

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(255).optional(),
  platformRole: platformRoleSchema.optional(),
  isBlocked: z.boolean().optional(),
});

/** Order status is a free string in the model; the closed set lives with the domain. */
export const updateOrderStatusSchema = z.object({
  status: z.string().trim().min(1).max(50).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Moderation changes one thing: whether the platform has withdrawn a review (R15).
 *
 * `isVerified` was accepted here and is deliberately gone — the store awards the
 * **Verified purchase** mark from its own order history, so it is not an admin's to
 * grant any more than it is a reviewer's to claim (R4). Required rather than optional,
 * because a PATCH that changes nothing is a request with no meaning.
 *
 * An author's retraction has no field here either: it is a different act by a different
 * person, and an admin restoring a withdrawal must not be able to un-retract someone's
 * words as a side effect (ADR-0032).
 */
export const updateReviewSchema = z.object({
  withdrawn: z.boolean(),
});

/**
 * The moderation queue's own query string (Invariant 4).
 *
 * Parsed rather than cast: `sortBy` and `sortOrder` reach Prisma's `orderBy` as keys, and
 * these arrived as `as any` off `searchParams` until PR-125 — `any` at a trust boundary,
 * which CLAUDE.md calls a defect and which here meant an arbitrary string naming a column.
 * `.catch()` on the paging and sort fields so a junk value is a default rather than a 400;
 * a filter the console did not write is not worth an error page.
 */
export const reviewQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  productId: z.string().trim().min(1).max(64).optional(),
  state: z.enum(["published", "withdrawn", "deleted"]).optional(),
  isVerified: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(["createdAt", "rating"]).catch("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).catch("desc"),
});
