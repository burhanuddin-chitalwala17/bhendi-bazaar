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
 * Blocking or unblocking a user (Invariant 4).
 *
 * The handler read `body.isBlocked === true` off an unparsed body, so a malformed payload —
 * `{}`, a string, a typo'd key — silently meant *unblock*. An admin action with two outcomes
 * must not default to one of them because the caller sent nothing recognisable.
 */
export const blockUserSchema = z.object({
  isBlocked: z.boolean(),
});
