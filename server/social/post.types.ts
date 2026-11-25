/** A shop's post and its destinations (social-selling/post-composer D1). */

export const POST_STATE = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  SAVED: "SAVED",
  PUBLISHING: "PUBLISHING",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;
export type PostState = (typeof POST_STATE)[keyof typeof POST_STATE];

export const POST_DESTINATION_KIND = {
  IG_FEED: "IG_FEED",
  IG_STORY: "IG_STORY",
  WA_STATUS: "WA_STATUS",
} as const;
export type PostDestinationKind = (typeof POST_DESTINATION_KIND)[keyof typeof POST_DESTINATION_KIND];
export const POST_DESTINATION_KINDS = Object.values(POST_DESTINATION_KIND) as [PostDestinationKind, ...PostDestinationKind[]];

/** Scheduling (U2) adds the rest of the A-D8 machine; a draft's destinations are only picked. */
export const POST_DESTINATION_STATE = {
  DRAFT: "DRAFT",
} as const;

/** Pictures in a carousel, and products a post is about (spec R2, R6). */
export const POST_MEDIA_MAX = 10;
export const POST_PRODUCTS_MAX = 10;
/**
 * A storage bound only: over Instagram's 2,200 a draft still saves and the field says so (spec R4);
 * schedule is what refuses.
 */
export const POST_CAPTION_STORED_MAX = 10_000;

/** A post as the composer edits it; `version` is what the next save must carry (D3). */
export interface PostDraftDTO {
  id: string;
  version: number;
  state: PostState;
  caption: string;
  mediaIds: string[];
  productIds: string[];
  destinations: PostDestinationKind[];
  scheduledAt: string | null;
  /** "Draft saved · 4 min ago" (ux.md). */
  updatedAt: string;
}

export const POST_COPY = {
  notFound: "Post not found",
  stale: "This draft was changed on another screen. Showing the latest.",
  notEditable: "This post has started publishing and can't be changed now.",
  mediaNotInLibrary: "This picture was deleted from your library. Pick another.",
  productNotYours: "A product isn't in your shop. Pick another.",
} as const;
