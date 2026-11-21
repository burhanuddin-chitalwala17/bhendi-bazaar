import sharp from "sharp";
import { sha256Hex } from "@server/shared/hash";
import { MediaAssetKind } from "@prisma/client";
import { mediaAssetRepository } from "@server/catalog/media-asset.repository";
import { adminProductsRepository } from "@server/catalog/product.repository";
import { adminCategoryRepository } from "@server/catalog/category.repository";
import { bannerRepository } from "@server/catalog/banner.repository";
import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import { orgBannerRepository } from "@server/catalog/org-banner.repository";
import { isOwnObjectUrl, pathnameFor, publicBaseUrl } from "@server/catalog/object-store";

/** The configured store, for a message; an unconfigured one is a fact the message should carry. */
function publicBaseUrlOrNone(): string {
  try {
    return publicBaseUrl();
  } catch {
    return "not configured";
  }
}

export interface BackfillOptions {
  /** Dry run by default: report what would happen, write nothing. */
  write: boolean;
  /** Injected so tests need no network; the script passes global fetch. */
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
  /** Proceed although no stored URL belongs to the configured store. See the check below. */
  allowForeign?: boolean;
}

export interface BackfillReport {
  imagesSeen: number;
  imagesCreated: number;
  embedsCreated: number;
  rowsLinked: number;
  withoutDimensions: string[];
  /** Ready images that gained a content hash on this run (D11); nothing on a dry run. */
  hashed: number;
}

/**
 * Bring every image already stored under the asset record (media-library R2, trd D3).
 *
 * Idempotent: a reference that already points at an asset is skipped, and a URL that already
 * has an asset is linked rather than duplicated. Not a migration because it needs the object
 * store, and not the seed because it is production data. Run once per database.
 */
/** One run hashes at most this many older assets; a bigger library takes a second run. */
const HASH_PASS_LIMIT = 2000;

/** Enough references to tell a configured store from a mismatched one, and few enough to be free. */
const STORE_CHECK_SAMPLE = 25;

/**
 * Does this library belong to some other store? True only when there are references to judge
 * and not one of them is ours — a single recognised URL is enough to say the pairing is right,
 * and an empty library says nothing either way.
 */
export function refusesForeignLibrary(
  refs: readonly string[],
  ownKey: (url: string) => string | null,
): boolean {
  if (refs.length === 0) return false;
  return !refs.some((ref) => ownKey(ref) !== null);
}

/**
 * The store this run points at must be the store the database's URLs live in.
 *
 * Nothing downstream notices when they disagree. Dimensions arrive over plain HTTP from the URL
 * itself, so a record is still written, complete but for `objectKey` — which is the one field
 * crop, improve and the deletion sweep all read. Worse, the run is idempotent on the reference,
 * so a corrected second run skips every asset the first one made and the null is permanent.
 *
 * A library of genuinely external URLs is a real state, so this is a refusal a caller can
 * override rather than a rule (`allowForeign`), in the shape Invariant 7 uses: the dangerous
 * thing is a second, separate intent.
 */
async function assertStoreMatchesDatabase(
  ownKey: (url: string) => string | null,
  base: string,
): Promise<void> {
  const [media, categories, banners, profiles, orgBanners] = await Promise.all([
    adminProductsRepository.sampleUnlinkedMediaRefs(STORE_CHECK_SAMPLE),
    // `heroImage` is not nullable but is often empty; the filter below drops those.
    adminCategoryRepository.listUnlinkedHeroes(STORE_CHECK_SAMPLE),
    bannerRepository.listUnlinkedImages(STORE_CHECK_SAMPLE),
    orgProfileRepository.listUnlinkedImages(STORE_CHECK_SAMPLE),
    orgBannerRepository.listUnlinkedImages(STORE_CHECK_SAMPLE),
  ]);

  const refs = [
    ...media.map((row) => row.ref),
    ...categories.map((row) => row.heroImage),
    ...banners.map((row) => row.imageUrl),
    ...profiles.flatMap((row) => [row.logoUrl, row.heroUrl]),
    ...orgBanners.map((row) => row.imageUrl),
  ].filter((ref): ref is string => typeof ref === "string" && ref.length > 0);

  if (!refusesForeignLibrary(refs, ownKey)) return;

  throw new Error(
    `None of the ${refs.length} image references sampled from this database belong to the ` +
      `configured store (R2_PUBLIC_BASE_URL is ${base}). That is what a production database ` +
      `paired with a development bucket looks like, and writing now would record every asset ` +
      `with no object key, which a later correct run cannot repair. Check the environment file ` +
      `you passed carries all five R2 values. If this library really is all external URLs, ` +
      `re-run with --allow-foreign.\n  e.g. ${refs[0]}`,
  );
}

export async function backfillMediaAssets(options: BackfillOptions): Promise<BackfillReport> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const log = options.log ?? (() => {});
  const report: BackfillReport = { imagesSeen: 0, imagesCreated: 0, embedsCreated: 0, rowsLinked: 0, withoutDimensions: [], hashed: 0 };
  const known = new Map<string, string>();

  const ownKey = (url: string): string | null => {
    try {
      return isOwnObjectUrl(url) ? pathnameFor(url) : null;
    } catch {
      // No store configured in this environment: every URL is external to it.
      return null;
    }
  };

  // A write stops; a dry run says what the write would refuse. The rehearsal reporting a clean
  // plan that the real run then declines is the rehearsal failing at its one job — and the
  // numbers it printed were counted against a store it did not recognise.
  if (!options.allowForeign) {
    const check = assertStoreMatchesDatabase(ownKey, publicBaseUrlOrNone());
    if (options.write) await check;
    else await check.catch((error: unknown) => log(`WARNING: ${error instanceof Error ? error.message : String(error)}`));
  }

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
    let contentHash: string | null = null;
    try {
      const response = await fetchImpl(ref);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const meta = await sharp(buffer).metadata();
        width = meta.width ?? null;
        height = meta.pageHeight ?? meta.height ?? null;
        bytes = buffer.byteLength;
        mimeType = response.headers.get("content-type") ?? null;
        contentHash = sha256Hex(buffer);
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
      contentHash,
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
  const media = await adminProductsRepository.listUnlinkedMedia();
  for (const row of media) {
    // A hosted video is linked on write, from confirm on (video-hosting D1); one left unlinked
    // was saved against a failed asset, and there is no image to make of it.
    if (row.kind === "VIDEO") continue;
    const assetId =
      row.kind === "YOUTUBE"
        ? await assetForEmbed(row.ref, row.product.orgId)
        : await assetForImage(row.ref, row.product.orgId);
    if (options.write) await adminProductsRepository.linkMediaAsset(row.id, assetId, row.product.orgId);
    report.rowsLinked += 1;
  }

  // Category heroes and home banners are the platform's own.
  for (const category of await adminCategoryRepository.listUnlinkedHeroes()) {
    if (!category.heroImage) continue;
    const assetId = await assetForImage(category.heroImage, null);
    if (options.write) await adminCategoryRepository.linkHeroAsset(category.id, assetId);
    report.rowsLinked += 1;
  }
  for (const banner of await bannerRepository.listUnlinkedImages()) {
    const assetId = await assetForImage(banner.imageUrl!, null);
    if (options.write) await bannerRepository.linkImageAsset(banner.id, assetId);
    report.rowsLinked += 1;
  }

  // An organisation's own face and signage.
  for (const profile of await orgProfileRepository.listUnlinkedImages()) {
    const data: { logoAssetId?: string; heroAssetId?: string } = {};
    if (profile.logoUrl && !profile.logoAssetId) data.logoAssetId = await assetForImage(profile.logoUrl, profile.orgId);
    if (profile.heroUrl && !profile.heroAssetId) data.heroAssetId = await assetForImage(profile.heroUrl, profile.orgId);
    if (options.write) await orgProfileRepository.linkImageAssets(profile.orgId, data);
    report.rowsLinked += Object.keys(data).length;
  }
  for (const banner of await orgBannerRepository.listUnlinkedImages()) {
    const assetId = await assetForImage(banner.imageUrl!, banner.orgId);
    if (options.write) await orgBannerRepository.linkImageAsset(banner.id, assetId);
    report.rowsLinked += 1;
  }

  // Assets recorded before the hash column existed: download once, hash, remember. Only on a
  // write, and only for what is still unhashed, so a re-run touches nothing (D11).
  if (options.write) {
    for (const row of await mediaAssetRepository.listWithoutHash(HASH_PASS_LIMIT)) {
      try {
        const response = await fetchImpl(row.ref);
        if (!response.ok) continue;
        await mediaAssetRepository.setHash(row.id, sha256Hex(Buffer.from(await response.arrayBuffer())));
        report.hashed += 1;
      } catch {
        // Unreachable now; the next run tries again.
      }
    }
  }

  log(
    `${options.write ? "Wrote" : "Would write"} ${report.imagesCreated} image assets and ${report.embedsCreated} video references; ` +
      `linked ${report.rowsLinked} rows; ${report.withoutDimensions.length} without dimensions; hashed ${report.hashed}.`,
  );
  return report;
}
