import { z } from "zod";

import {
  POST_CAPTION_STORED_MAX,
  POST_DESTINATION_KINDS,
  POST_MEDIA_MAX,
  POST_PRODUCTS_MAX,
} from "@server/social/post.types";

const id = z.string().min(1).max(64);
const distinct = <T>(list: T[]) => new Set(list).size === list.length;

/**
 * A draft as the composer holds it (post-composer D1, D3). A draft may be over Instagram's caption
 * limits (spec R4); only schedule refuses. Create and save take the same fields; save adds the version.
 */
export const postDraftSchema = z.object({
  caption: z.string().max(POST_CAPTION_STORED_MAX).default(""),
  mediaIds: z.array(id).max(POST_MEDIA_MAX).refine(distinct, "Each picture once.").default([]),
  productIds: z.array(id).max(POST_PRODUCTS_MAX, "Up to 10 products.").refine(distinct, "Each product once.").default([]),
  destinations: z.array(z.enum(POST_DESTINATION_KINDS)).refine(distinct, "Each place once.").default([]),
});
export type PostDraftInput = z.infer<typeof postDraftSchema>;

export const postDraftSaveSchema = postDraftSchema.extend({
  version: z.number().int().min(0),
});
export type PostDraftSaveInput = z.infer<typeof postDraftSaveSchema>;
