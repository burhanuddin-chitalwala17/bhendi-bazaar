/**
 * A destination as the containers Instagram's content API makes (instagram-publishing TRD D1, D5);
 * pure. A carousel is its children first, then a parent naming them, which `withChildren` completes.
 */

import { POST_DESTINATION_KIND } from "@server/social/post.types";

export const IG_DESTINATION = { FEED: POST_DESTINATION_KIND.IG_FEED, STORY: POST_DESTINATION_KIND.IG_STORY } as const;
export type IgDestinationKind = (typeof IG_DESTINATION)[keyof typeof IG_DESTINATION];

export const IG_MEDIA_KIND = { IMAGE: "IMAGE", VIDEO: "VIDEO" } as const;
export type IgMediaKind = (typeof IG_MEDIA_KIND)[keyof typeof IG_MEDIA_KIND];

export const IG_SHAPE = {
  IMAGE: "IMAGE",
  CAROUSEL: "CAROUSEL",
  REEL: "REEL",
  STORY: "STORY",
} as const;
export type IgShape = (typeof IG_SHAPE)[keyof typeof IG_SHAPE];

/** Why a destination cannot be built; the publish maps each to ux.md's words. */
export const IG_REFUSAL = {
  SHAPE: "SHAPE",
  TAGS_ON_REEL: "TAGS_ON_REEL",
  TAG_OFF_PICTURE: "TAG_OFF_PICTURE",
  TOO_MANY_COLLABORATORS: "TOO_MANY_COLLABORATORS",
  NOT_ON_STORY: "NOT_ON_STORY",
} as const;
export type IgRefusal = (typeof IG_REFUSAL)[keyof typeof IG_REFUSAL];

/** Instagram's own bounds (spec R2, R4). */
export const IG_CAROUSEL_MIN = 2;
export const IG_CAROUSEL_MAX = 10;
export const IG_COLLABORATORS_MAX = 3;

export interface IgMedia {
  kind: IgMediaKind;
  /** A public address Instagram fetches. */
  url: string;
}

/** The plug's fields (D5); U3 adds their schema. `image` is the tagged picture's index in the post. */
export interface IgFields {
  userTags: Array<{ image: number; handle: string; x: number; y: number }>;
  collaborators: string[];
  locationId: string | null;
}

export interface IgContainersInput {
  kind: IgDestinationKind;
  caption: string;
  media: IgMedia[];
  fields: IgFields;
}

/** Graph's form parameters for one `POST /{ig-user-id}/media`. */
export type IgContainerParams = Record<string, string>;

export type IgContainers =
  | { ok: true; shape: IgShape; children: IgContainerParams[]; parent: IgContainerParams }
  | { ok: false; reason: IgRefusal };

/** The shape is derived from the media, never stored (post-composer D1). */
export function instagramShape(kind: IgDestinationKind, media: readonly IgMedia[]): IgShape | null {
  if (kind === IG_DESTINATION.STORY) return media.length === 1 ? IG_SHAPE.STORY : null;
  if (media.length === 1) return media[0]?.kind === IG_MEDIA_KIND.VIDEO ? IG_SHAPE.REEL : IG_SHAPE.IMAGE;
  // Pictures only, as post-composer R2 has it, though the API takes videos too (decisions Q11).
  const images = media.every((item) => item.kind === IG_MEDIA_KIND.IMAGE);
  return images && media.length >= IG_CAROUSEL_MIN && media.length <= IG_CAROUSEL_MAX ? IG_SHAPE.CAROUSEL : null;
}

const handle = (value: string) => value.trim().replace(/^@/, "");

function tagsOn(fields: IgFields, image: number): IgContainerParams {
  const tags = fields.userTags
    .filter((tag) => tag.image === image)
    .map((tag) => ({ username: handle(tag.handle), x: tag.x, y: tag.y }));
  return tags.length > 0 ? { user_tags: JSON.stringify(tags) } : {};
}

const collaboratorsOf = (fields: IgFields) => [...new Set(fields.collaborators.map(handle))];

function feedExtras(fields: IgFields): IgContainerParams {
  const collaborators = collaboratorsOf(fields);
  return {
    ...(collaborators.length > 0 ? { collaborators: JSON.stringify(collaborators) } : {}),
    ...(fields.locationId ? { location_id: fields.locationId } : {}),
  };
}

const mediaParam = (item: IgMedia): IgContainerParams =>
  item.kind === IG_MEDIA_KIND.VIDEO ? { video_url: item.url } : { image_url: item.url };

export function buildContainers(input: IgContainersInput): IgContainers {
  const { media, fields } = input;
  const shape = instagramShape(input.kind, media);
  if (!shape) return { ok: false, reason: IG_REFUSAL.SHAPE };

  const inBounds = (n: number) => n >= 0 && n <= 1;
  const offPicture = fields.userTags.some(
    (tag) => media[tag.image]?.kind !== IG_MEDIA_KIND.IMAGE || !inBounds(tag.x) || !inBounds(tag.y),
  );
  if (shape === IG_SHAPE.REEL && fields.userTags.length > 0) return { ok: false, reason: IG_REFUSAL.TAGS_ON_REEL };
  if (offPicture) return { ok: false, reason: IG_REFUSAL.TAG_OFF_PICTURE };
  if (collaboratorsOf(fields).length > IG_COLLABORATORS_MAX) return { ok: false, reason: IG_REFUSAL.TOO_MANY_COLLABORATORS };

  const first = media[0] as IgMedia;
  switch (shape) {
    case IG_SHAPE.STORY:
      // A story takes no caption, collaborators or location through the API.
      if (fields.collaborators.length > 0 || fields.locationId) return { ok: false, reason: IG_REFUSAL.NOT_ON_STORY };
      return { ok: true, shape, children: [], parent: { media_type: "STORIES", ...mediaParam(first), ...tagsOn(fields, 0) } };
    case IG_SHAPE.REEL:
      return {
        ok: true,
        shape,
        children: [],
        parent: { media_type: "REELS", ...mediaParam(first), caption: input.caption, share_to_feed: "true", ...feedExtras(fields) },
      };
    case IG_SHAPE.IMAGE:
      return {
        ok: true,
        shape,
        children: [],
        parent: { ...mediaParam(first), caption: input.caption, ...tagsOn(fields, 0), ...feedExtras(fields) },
      };
    case IG_SHAPE.CAROUSEL:
      return {
        ok: true,
        shape,
        children: media.map((item, index) => ({ ...mediaParam(item), is_carousel_item: "true", ...tagsOn(fields, index) })),
        parent: { media_type: "CAROUSEL", caption: input.caption, ...feedExtras(fields) },
      };
  }
}

/** A carousel's parent once its children's containers exist, in the post's order. */
export function withChildren(parent: IgContainerParams, childIds: readonly string[]): IgContainerParams {
  return { ...parent, children: childIds.join(",") };
}
