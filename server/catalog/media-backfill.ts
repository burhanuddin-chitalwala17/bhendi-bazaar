import sharp from "sharp";
import { MediaAssetKind } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { isOwnObjectUrl, pathnameFor } from "@server/catalog/object-store";

export interface BackfillOptions {
  /** Dry run by default: report what would happen, write nothing. */
  write: boolean;
  /** Injected so tests need no network; the script passes global fetch. */
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}

export interface BackfillReport {
  imagesSeen: number;
  imagesCreated: number;
  embedsCreated: number;
  rowsLinked: number;
  withoutDimensions: string[];
}

/**
 * Bring every image already stored under the asset record (media-library R2, trd D3).
 *
 * Idempotent: a reference that already points at an asset is skipped, and a URL that already
 * has an asset is linked rather than duplicated. Not a migration because it needs the object
 * store, and not the seed because it is production data. Run once per database.
 */
export async function backfillMediaAssets(options: BackfillOptions): Promise<BackfillReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.log ?? (() => {});
  const report: BackfillReport = { imagesSeen: 0, imagesCreated: 0, embedsCreated: 0, rowsLinked: 0, withoutDimensions: [] };
  const known = new Map<string, string>();

  const ownKey = (url: string): string | null => {
    try {
      return isOwnObjectUrl(url) ? pathnameFor(url) : null;
    } catch {
      // No store configured in this environment: every URL is external to it.
      return null;
    }
  };

  const assetForImage = async (ref: string, orgId: string | null): Promise<string> => {
    const cached = known.get(ref);
    if (cached) return cached;
    const existing = await mediaAssetRepository.findByRef(MediaAssetKind.IMAGE, ref);
    if (existing) {
      known.set(ref, existing.id);
      return existing.id;
    }
    report.imagesSeen += 1;
    let width: number | null = null;
    let height: number | null = null;
    let bytes: number | null = null;
    let mimeType: string | null = null;
    try {
      const response = await fetchImpl(ref);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const meta = await sharp(buffer).metadata();
        width = meta.width ?? null;
        height = meta.pageHeight ?? meta.height ?? null;
        bytes = buffer.byteLength;
        mimeType = response.headers.get("content-type") ?? null;
      }
    } catch {
      // Recorded below; a URL nobody can fetch is still a reference the catalogue holds.
    }
    if (width === null || height === null) report.withoutDimensions.push(ref);
    if (!options.write) {
      known.set(ref, "dry-run");
      report.imagesCreated += 1;
      return "dry-run";
    }
    const created = await mediaAssetRepository.createReady({
      orgId,
      uploaderId: null,
      ref,
      objectKey: ownKey(ref),
      mimeType,
      bytes,
      width,
      height,
    });
    known.set(ref, created.id);
    report.imagesCreated += 1;
    return created.id;
  };

  const assetForEmbed = async (ref: string, orgId: string | null): Promise<string> => {
    const cacheKey = `embed:${ref}`;
    const cached = known.get(cacheKey);
    if (cached) return cached;
    const existing = await mediaAssetRepository.findByRef(MediaAssetKind.VIDEO_EMBED, ref);
    if (existing) {
      known.set(cacheKey, existing.id);
      return existing.id;
    }
    report.embedsCreated += 1;
    if (!options.write) {
      known.set(cacheKey, "dry-run");
      return "dry-run";
    }
    const created = await mediaAssetRepository.createEmbed({ orgId, ref });
    known.set(cacheKey, created.id);
    return created.id;
  };

  // Product galleries: images and video references, owned by the product's org.
  const media = await prisma.productMedia.findMany({
    where: { assetId: null },
    select: { id: true, kind: true, ref: true, product: { select: { orgId: true } } },
  });
  for (const row of media) {
    const assetId =
      row.kind === "YOUTUBE"
        ? await assetForEmbed(row.ref, row.product.orgId)
        : await assetForImage(row.ref, row.product.orgId);
    if (options.write) await prisma.productMedia.update({ where: { id: row.id }, data: { assetId } });
    report.rowsLinked += 1;
  }

  // Category heroes and home banners are the platform's own.
  for (const category of await prisma.category.findMany({ where: { heroAssetId: null }, select: { id: true, heroImage: true } })) {
    if (!category.heroImage) continue;
    const assetId = await assetForImage(category.heroImage, null);
    if (options.write) await prisma.category.update({ where: { id: category.id }, data: { heroAssetId: assetId } });
    report.rowsLinked += 1;
  }
  for (const banner of await prisma.banner.findMany({ where: { imageAssetId: null, imageUrl: { not: null } }, select: { id: true, imageUrl: true } })) {
    const assetId = await assetForImage(banner.imageUrl!, null);
    if (options.write) await prisma.banner.update({ where: { id: banner.id }, data: { imageAssetId: assetId } });
    report.rowsLinked += 1;
  }

  // An organisation's own face and signage.
  for (const profile of await prisma.orgProfile.findMany({
    where: { OR: [{ logoAssetId: null, logoUrl: { not: null } }, { heroAssetId: null, heroUrl: { not: null } }] },
    select: { orgId: true, logoUrl: true, logoAssetId: true, heroUrl: true, heroAssetId: true },
  })) {
    const data: { logoAssetId?: string; heroAssetId?: string } = {};
    if (profile.logoUrl && !profile.logoAssetId) data.logoAssetId = await assetForImage(profile.logoUrl, profile.orgId);
    if (profile.heroUrl && !profile.heroAssetId) data.heroAssetId = await assetForImage(profile.heroUrl, profile.orgId);
    if (options.write) await prisma.orgProfile.update({ where: { orgId: profile.orgId }, data });
    report.rowsLinked += Object.keys(data).length;
  }
  for (const banner of await prisma.orgBanner.findMany({ where: { imageAssetId: null, imageUrl: { not: null } }, select: { id: true, orgId: true, imageUrl: true } })) {
    const assetId = await assetForImage(banner.imageUrl!, banner.orgId);
    if (options.write) await prisma.orgBanner.update({ where: { id: banner.id }, data: { imageAssetId: assetId } });
    report.rowsLinked += 1;
  }

  log(
    `${options.write ? "Wrote" : "Would write"} ${report.imagesCreated} image assets and ${report.embedsCreated} video references; ` +
      `linked ${report.rowsLinked} rows; ${report.withoutDimensions.length} without dimensions.`,
  );
  return report;
}
