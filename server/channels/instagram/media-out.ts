import { MediaAssetKind, MediaAssetState } from "@prisma/client";

import { mediaAssetService } from "@server/catalog/media-asset.service";
import type { MediaSurfaceKey } from "@server/catalog/media";
import { renditionUrl } from "@server/content/renditions.service";
import { NotFoundError } from "@server/shared/domain-error";
import { IG_DESTINATION, IG_MEDIA_KIND, type IgDestinationKind, type IgMedia } from "./containers";

/** How the shop crops its feed pictures: Instagram's 1:1 or 4:5 (ux.md crop chips). */
export const IG_FEED_ASPECT = { SQUARE: "SQUARE", PORTRAIT: "PORTRAIT" } as const;
export type IgFeedAspect = (typeof IG_FEED_ASPECT)[keyof typeof IG_FEED_ASPECT];

/** A picked asset is gone or not ready at publish; the destination fails with a reason (post-composer D7). */
export const IG_MEDIA_MISSING = "MEDIA_MISSING";

export type IgMediaOut = { ok: true; media: IgMedia[] } | { ok: false; reason: typeof IG_MEDIA_MISSING };

function surfaceFor(kind: IgDestinationKind, aspect: IgFeedAspect): MediaSurfaceKey {
  if (kind === IG_DESTINATION.STORY) return "instagramStory";
  return aspect === IG_FEED_ASPECT.PORTRAIT ? "instagramPortrait" : "instagramSquare";
}

/**
 * The addresses Instagram fetches for a destination's media, in the post's order (D1): a picture
 * as a JPEG rendition at the destination's size, made at publish and kept; a video as its largest
 * stored MP4.
 */
export async function instagramMedia(
  orgId: string,
  kind: IgDestinationKind,
  aspect: IgFeedAspect,
  assetIds: readonly string[],
): Promise<IgMediaOut> {
  const out: IgMedia[] = [];
  for (const id of assetIds) {
    let asset;
    try {
      ({ asset } = await mediaAssetService.assetDetail(orgId, id));
    } catch (error) {
      if (error instanceof NotFoundError) return { ok: false, reason: IG_MEDIA_MISSING };
      throw error;
    }
    if (asset.state !== MediaAssetState.READY) return { ok: false, reason: IG_MEDIA_MISSING };
    if (asset.kind === MediaAssetKind.VIDEO) {
      const largest = asset.renditions[0];
      if (!largest) return { ok: false, reason: IG_MEDIA_MISSING };
      out.push({ kind: IG_MEDIA_KIND.VIDEO, url: largest.url });
    } else {
      out.push({ kind: IG_MEDIA_KIND.IMAGE, url: await renditionUrl(orgId, asset.id, surfaceFor(kind, aspect)) });
    }
  }
  return { ok: true, media: out };
}
