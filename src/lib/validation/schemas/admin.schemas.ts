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
 * Moderation changes one thing: whether a review is published (product-reviews R15).
 *
 * `isVerified` was accepted here and is deliberately gone — the store awards the
 * **Verified purchase** mark from its own order history, so it is not an admin's to
 * grant any more than it is a reviewer's to claim (R4). Required rather than optional,
 * because a PATCH that changes nothing is a request with no meaning.
 */
export const updateReviewSchema = z.object({
  isApproved: z.boolean(),
});
