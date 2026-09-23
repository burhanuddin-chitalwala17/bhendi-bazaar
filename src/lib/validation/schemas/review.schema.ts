import { z } from "zod";

import { MAX_REVIEW_PHOTOS } from "@server/catalog/media";

/**
 * What a shopper may send about a review (product-reviews R7, Invariant 4).
 *
 * One schema for the form and the route, so the inline message a reviewer sees cannot
 * drift from what the server enforces (ADR-0013). Everything else about a review is the
 * server's: the display name comes from the account (R11), the **Verified purchase**
 * mark from order history (R4), publication from the column default (R15) — none of them
 * have a field here, and create and update accept exactly the same fields.
 */
const ratingField = z
  .number({ message: "Choose a star rating." })
  .int("Choose a star rating.")
  .min(1, "Choose a star rating.")
  .max(5, "Choose a star rating.");

/** Empty is the same as absent: an untouched optional field arrives as "". */
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .optional()
    .transform((value) => (value ? value : undefined));

/**
 * Photographs the browser has already uploaded, by URL (review-media R1, trd.md D8).
 *
 * Shape only. That each URL is an object *this author* uploaded is enforced in the
 * service, not here: the test needs the bucket's public base URL, which is server
 * configuration, and this schema is also the form's client-side validation (ADR-0013).
 * Bucket membership is not ownership — see `isOwnReviewPhoto` for why citing any URL in
 * our own bucket was a way to delete a product's photograph.
 */
const photosField = z
  .array(z.string().trim().url("That photo did not upload properly."))
  .max(MAX_REVIEW_PHOTOS, `A review can carry ${MAX_REVIEW_PHOTOS} photos.`)
  .optional()
  .transform((value) => value ?? []);

/**
 * A review carries photographs and nothing else (review-media R5a).
 *
 * There is deliberately no `video` field. A link to somebody else's host is content the
 * platform can neither see nor take down, and it can change after moderation has looked
 * at it — a cost the product gallery accepts from its own orgs and a review should
 * not accept from strangers. `MediaKind` keeps `YOUTUBE`, so this is a field to add
 * back rather than a schema to migrate if that judgement changes.
 */
export const reviewSubmissionSchema = z.object({
  rating: ratingField,
  title: optionalText(120, "Keep the headline under 120 characters."),
  comment: optionalText(2000, "Keep the review under 2000 characters."),
  photos: photosField,
});

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;

/** `?page=` on the read-more call. A missing or junk page is page one, not an error. */
export const reviewPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
});
