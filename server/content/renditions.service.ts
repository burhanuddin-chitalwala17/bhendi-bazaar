import sharp from "sharp";

import { mediaAssetService } from "@server/catalog/media-asset.service";
import {
  MEDIA_SURFACES,
  type MediaSurface,
  type MediaSurfaceKey,
} from "@server/catalog/media";

/**
 * The image a surface gets, made once (renditions R1–R4).
 *
 * A surface asks for a source and a size; it gets back a URL. The first ask renders and
 * records a derived image, every later ask finds that one — the pair of source and surface is
 * what identifies it, so nothing renders the same pixels twice. Catalog is reached through its
 * asset service and never its repository
 * ([ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)).
 *
 * Inline, in the request that first needs it, because one of these is a few hundred
 * milliseconds of sharp (D4). Moving it to the worker later changes where this is called from
 * and nothing about what it does.
 */

/**
 * Does this picture hold the pixels the surface wants?
 *
 * The question R4 asks, made checkable. Filling the box means scaling by whichever side falls
 * shortest; if that scale is above one the picture is being enlarged to fit, which is the
 * stretching the requirement forbids. A hundredth of slack, because a photograph rounded to
 * whole pixels is never exactly the shape it was cut to.
 */
export function coversSurface(
  picture: { width: number | null; height: number | null },
  surface: MediaSurface,
): boolean {
  if (!picture.width || !picture.height) return false;
  const scale = Math.max(surface.width / picture.width, surface.height / picture.height);
  return scale <= 1.01;
}

/**
 * The picture to render from: the shop's own crop when it has the pixels, else the untouched
 * original it was cut from (R4, D3).
 *
 * A square crop asked for a portrait is the case this exists for. Reaching back loses the
 * shop's framing, which is the lesser harm — a stretched or padded picture is one nobody
 * chose, and the original at least shows the thing itself.
 */
export async function sourceForSurface(
  assetId: string,
  surface: MediaSurface,
): Promise<string> {
  const asset = await mediaAssetService.describeForRendition(assetId);
  if (!asset) return assetId;
  if (coversSurface(asset, surface)) return assetId;
  return asset.derivedFromId ?? assetId;
}

/** The surface's own key is the transform, so the pair is unique and readable in the row. */
const transformFor = (surface: MediaSurfaceKey) => ({ surface });

/**
 * The URL of this source at this surface, rendering it the first time.
 *
 * Idempotent on the pair: two requests arriving together both render, and the second finds the
 * first already recorded because a derived image is deduplicated by its content hash — so the
 * loser costs a few hundred milliseconds and no second row.
 */
export async function renditionUrl(
  orgId: string,
  assetId: string,
  surfaceKey: MediaSurfaceKey,
): Promise<string> {
  const surface = MEDIA_SURFACES[surfaceKey];

  const existing = await mediaAssetService.findRendition(assetId, surfaceKey);
  if (existing) return existing.ref;

  const from = await sourceForSurface(assetId, surface);
  const { bytes } = await mediaAssetService.readImageBytes(from);

  const rendered = await sharp(bytes)
    .rotate()
    .resize(surface.width, surface.height, {
      fit: surface.fit,
      withoutEnlargement: true,
    })
    .webp({ quality: surface.quality })
    .toBuffer();

  // Recorded against the asset that was asked for, not the one it was rendered from: the
  // caller asked this asset for this surface, and that is the pair the next ask looks up.
  const derived = await mediaAssetService.registerDerivedBytes({
    orgId,
    uploaderId: null,
    sourceAssetId: assetId,
    bytes: rendered,
    fileSuffix: `${surfaceKey}.webp`,
    contentType: "image/webp",
    transform: transformFor(surfaceKey),
  });

  return derived.ref;
}

/**
 * The same, for a caller holding a stored URL rather than an asset id.
 *
 * A page that already has the picture's address should not have to learn the library's
 * identifiers to ask for a size of it, and the public payload should not have to carry an
 * asset id nobody outside looks at. Falls back to the URL it was given: a link preview with
 * the full-size cover is worse than one sized for the slot and far better than none, so a
 * surface that cannot be made must not take the page down with it.
 */
export async function renditionUrlForRef(
  orgId: string,
  ref: string,
  surfaceKey: MediaSurfaceKey,
): Promise<string> {
  try {
    const asset = await mediaAssetService.findImageByRef(ref);
    if (!asset) return ref;
    return await renditionUrl(orgId, asset.id, surfaceKey);
  } catch {
    return ref;
  }
}
