import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { uniqueViolationFields } from "@server/shared/constraint";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";
import { productsService } from "@server/catalog/admin.product.service";
import { DEFAULT_WEIGHT_KG } from "@server/catalog/admin.product.types";
import { stockService } from "@server/catalog/stock.service";
import { mediaImportService } from "@server/catalog/media-import.service";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { orgAddressService } from "@server/catalog/org.address.service";

import {
  LISTING_STATUS,
  SUGGESTION_KIND,
  isMarketplaceChannel,
  type ListingStatus,
  type MarketplaceChannel,
  type SettleDetailDTO,
  type SettleInput,
  type SettlePickerProductDTO,
  type SettleResultDTO,
  type SettleSideDTO,
} from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { channelFactsService } from "./channel-facts.service";
import { mostSimilar } from "./listing-match";
import { copyablePhotos } from "./listing-photos";
import { PHOTO_COPY_MODE, listingPhotosSpec, type ListingPhotosPayload } from "./listing-photos.job";
import { providerFor } from "./providers";
import type { ListingDetail } from "./providers/listing-read";

/**
 * Settling a marketplace listing (product-merge): matched to a product, or added as a new one,
 * with the same item on the shop's other marketplace kept with it. Nothing is written to a
 * marketplace (Q15). Leave off and Bring back are channel-import.service's.
 */

type SettleRow = Awaited<ReturnType<typeof channelListingRepository.forSettle>>[number];

const MAIN_PHOTO_FAILED = (label: string) => `Couldn't copy ${label}'s main photo. Try again, or add a photo.`;

async function detailOf(row: Pick<SettleRow, "connectionId" | "channel" | "sku" | "externalId" | "connection">): Promise<ListingDetail> {
  if (!isMarketplaceChannel(row.channel)) throw new NotFoundError("Channel");
  return await providerFor(row.channel).listingDetail(
    () => channelConnectionService.accessToken(row.connectionId),
    row.connection.externalAccountId,
    { sku: row.sku, externalId: row.externalId },
  );
}

async function sideOf(row: SettleRow): Promise<SettleSideDTO> {
  const channel = row.channel as MarketplaceChannel;
  let detail: ListingDetail | null = null;
  try {
    detail = await detailOf(row);
  } catch {
    // The page still opens on what the inbox stored; the save re-reads before copying photos.
  }
  return {
    listingId: row.id,
    channel,
    label: CHANNEL_LABELS[channel],
    sku: row.sku,
    externalId: row.externalId,
    status: row.status as ListingStatus | null,
    live: row.status === LISTING_STATUS.LIVE && row.goneAt === null,
    pricePaise: row.pricePaise,
    quantity: row.quantity,
    title: detail?.title ?? row.title,
    description: detail?.description ?? null,
    photoUrls: detail ? detail.photoUrls : row.imageUrl ? [row.imageUrl] : [],
    readFailed: detail === null,
  };
}

/** Thrown inside the settle transaction when its listings were taken first; named after it rolls back. */
class TakenMeanwhile extends Error {}

/** On `listingIds`, so the page can offer "Back to listings" beside it. */
function settledMeanwhile(row: SettleRow): ConflictError {
  return new ConflictError(
    row.leftOffAt
      ? "This listing was just left off Bhendi Bazaar. Nothing was changed."
      : `This listing was just linked to ${row.product?.name ?? "another product"}. Nothing was changed.`,
    { field: "listingIds" },
  );
}

export const channelSettleService = {
  /** The Settle page (ux.md): the listing read live, its pair, the product being matched, defaults. */
  async page(orgId: string, listingId: string, productId: string | null): Promise<SettleDetailDTO | null> {
    const [row] = await channelListingRepository.forSettle([listingId], orgId);
    if (!row || !isMarketplaceChannel(row.channel)) return null;
    const connection = await channelConnectionRepository.find(orgId, row.channel);

    const [primary, product, locations, pair, latest, type] = await Promise.all([
      sideOf(row),
      productId ? productService.settleFacts(orgId, productId) : Promise.resolve(null),
      orgAddressService.listLocations(orgId),
      productId ? Promise.resolve(null) : this.pairFor(orgId, row),
      channelListingRepository.latestOwnerLinkedProductId(orgId),
      productId ? Promise.resolve(null) : channelFactsService.settleType(row),
    ]);
    if (productId && !product) return null;
    // The mapped type's one category starts the add (marketplace-facts D9); else the shop's last one (product-merge D9).
    const typed = type?.kind === "mapped" && type.types[0]?.categories.length === 1 ? type.types[0].categories[0].id : null;
    const lastCategory = typed ?? (latest ? (await productService.settleFacts(orgId, latest))?.categoryId ?? null : null);

    return {
      mode: product ? "match" : "new",
      primary,
      pair,
      product: product
        ? {
            id: product.id,
            name: product.name,
            sku: product.sku,
            description: product.description,
            pricePaise: product.pricePaise,
            photoUrls: product.photoUrls,
            archived: product.archived,
            stock: product.stock,
          }
        : null,
      locations: locations.filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name })),
      defaultCategoryId: lastCategory,
      type,
      readFinishedAt: connection?.readFinishedAt?.toISOString() ?? null,
    };
  },

  /** The same item on another connected marketplace (Q4): same SKU first, then the closest title. */
  async pairFor(orgId: string, row: SettleRow): Promise<SettleDetailDTO["pair"]> {
    const elsewhere = await channelListingRepository.unsettledElsewhere(orgId, row.connectionId);
    const bySku = elsewhere.find((other) => other.skuKey === row.skuKey);
    const byName =
      bySku || !row.title
        ? null
        : (mostSimilar(row.title, elsewhere.map((other) => ({ ...other, name: other.title ?? "" })), 1)[0] ?? null);
    const match = bySku ?? byName;
    if (!match) return null;
    const [full] = await channelListingRepository.forSettle([match.id], orgId);
    if (!full) return null;
    return { side: await sideOf(full), reason: bySku ? SUGGESTION_KIND.SAME_SKU : SUGGESTION_KIND.SIMILAR_NAME };
  },

  /** The match picker (Q22): the closest names first, then everything matching the search. */
  async pickerProducts(orgId: string, listingId: string, search: string | null) {
    const [row] = await channelListingRepository.forSettle([listingId], orgId);
    if (!row) throw new NotFoundError("Listing");
    const [products, linked] = await Promise.all([
      productService.listForMatching(orgId),
      channelListingRepository.productIdsLinkedOn(row.connectionId),
    ]);
    const toDto = (p: (typeof products)[number]): SettlePickerProductDTO => ({ ...p, linkedHere: linked.has(p.id) });
    const q = search?.trim().toLowerCase() ?? "";
    const similar = q === "" && row.title ? mostSimilar(row.title, products, 3) : [];
    const shown = new Set(similar.map((p) => p.id));
    const all = products
      .filter((p) => !shown.has(p.id))
      .filter((p) => q === "" || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
      .slice(0, 50);
    return { similar: similar.map(toDto), all: all.map(toDto) };
  },

  /** "Add product" or "Link and save" (D4): every listing linked, or none, and the product with them. */
  async settle(orgId: string, userId: string, input: SettleInput): Promise<SettleResultDTO> {
    const rows = await channelListingRepository.forSettle(input.listingIds, orgId);
    if (rows.length !== input.listingIds.length) throw new NotFoundError("Listing");
    if (new Set(rows.map((r) => r.connectionId)).size !== rows.length) {
      throw new DomainError("Pick one listing per marketplace.", { status: 400 });
    }
    const unsettled = rows.find((r) => r.productId || r.leftOffAt);
    if (unsettled) throw settledMeanwhile(unsettled);

    const matching = Boolean(input.productId);
    const target = matching ? await productService.settleFacts(orgId, input.productId!) : null;
    if (matching && !target) throw new NotFoundError("Product");

    if (!matching) await this.assertSkuFree(orgId, rows, input.sku!);
    if (target) await this.assertNotLinkedHere(rows, target.id, target.name);

    const photoSource = input.photosFrom ? rows.find((r) => r.id === input.photosFrom) : null;
    if (input.photosFrom && !photoSource) throw new DomainError("Pick photos from a listing being settled.", { status: 400 });
    const photos = photoSource ? copyablePhotos((await detailOf(photoSource).catch(() => ({ photoUrls: [] as string[] }))).photoUrls) : [];

    // The main photo is ours before anything is written (Q29); a failed copy writes nothing.
    let mainPhoto: string | null = null;
    if (!matching) {
      if (input.uploadedPhoto) {
        const asset = await mediaAssetService.findReadyImage(orgId, { ref: input.uploadedPhoto });
        if (!asset) throw new DomainError("Add at least one photo.", { status: 400, field: "uploadedPhoto" });
        mainPhoto = asset.ref;
      } else {
        const label = photoSource ? CHANNEL_LABELS[photoSource.channel as MarketplaceChannel] : "the marketplace";
        if (photos.length === 0) throw new DomainError(MAIN_PHOTO_FAILED(label), { status: 502, field: "photosFrom" });
        mainPhoto = await mediaImportService.fromUrl(orgId, userId, photos[0]).catch(() => {
          throw new DomainError(MAIN_PHOTO_FAILED(label), { status: 502, field: "photosFrom" });
        });
      }
    }

    const anyLive = rows.some((r) => r.status === LISTING_STATUS.LIVE && !r.goneAt);
    const archived = !matching && !anyLive && !input.onSale;
    const now = new Date();
    const queued = photoSource ? photos.slice(matching ? 0 : 1) : [];

    // A stock row is the shop's own location or nothing (Invariant 6's rows, scoped like the create path).
    const owned = new Set((await orgAddressService.listLocations(orgId)).map((l) => l.id));
    if (input.stock.some((s) => !owned.has(s.locationId))) {
      throw new DomainError("One of the chosen pickup locations does not belong to this organisation", { status: 400, field: "stock" });
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // The listings first: a second settle of them waits here and finds them taken (D4).
        if ((await channelListingRepository.lockUnsettled(tx, input.listingIds, orgId)) !== input.listingIds.length) {
          throw new TakenMeanwhile();
        }
        let productId: string;
        let productName: string;
        if (target) {
          await productsService.updateNamedFieldsIn(tx, target.id, orgId, { name: input.name, description: input.description });
          await stockService
            .setCounted(
              target.id,
              input.stock.map((s) => ({ orgAddressId: s.locationId, quantity: s.quantity, seenQuantity: s.seenQuantity })),
              tx,
            )
            .catch((error: unknown) => {
              if (error instanceof ConflictError) {
                throw new ConflictError(
                  `The stock of ${target.name} changed while you were here. Check the numbers and save again.`,
                  { field: "stock" },
                );
              }
              throw error;
            });
          productId = target.id;
          productName = input.name ?? target.name;
        } else {
          const created = await productsService.createForListingIn(
            tx,
            {
              name: input.name!,
              description: input.description ?? "",
              price: input.pricePaise!,
              orgId,
              categoryId: input.categoryId!,
              media: [{ kind: "IMAGE", ref: mainPhoto!, isThumbnail: true }],
              stockLocations: input.stock.map((s) => ({ orgAddressId: s.locationId, quantity: s.quantity })),
              sku: input.sku,
              weight: DEFAULT_WEIGHT_KG,
            },
            archived,
          );
          productId = created.id;
          productName = created.name;
        }

        let linked: number;
        try {
          linked = await channelListingRepository.settleLink(tx, input.listingIds, orgId, productId, now);
        } catch (error) {
          if (uniqueViolationFields(error) !== null) {
            throw new ConflictError(`${productName} is already linked to another listing on that marketplace. Unlink that one first.`);
          }
          throw error;
        }
        // Two members, or two taps: the second finds the rows taken and rolls back its product.
        if (linked !== input.listingIds.length) throw new TakenMeanwhile();

        // Each settled listing fills its product's empty facts, on the worker (marketplace-facts Q3).
        await channelFactsService.enqueueIn(tx, orgId, input.listingIds);

        if (photoSource && queued.length > 0) {
          await channelListingRepository.startPhotoCopy(
            tx,
            photoSource.id,
            queued.length,
            matching ? PHOTO_COPY_MODE.REPLACE : PHOTO_COPY_MODE.APPEND,
            now,
          );
          const payload: ListingPhotosPayload = {
            orgId,
            listingId: photoSource.id,
            productId,
            mode: matching ? PHOTO_COPY_MODE.REPLACE : PHOTO_COPY_MODE.APPEND,
            skipFirst: !matching,
          };
          await enqueue(tx, listingPhotosSpec, payload);
        }
        return { productId, productName };
      },
      { timeout: 20_000 },
    ).catch(async (error: unknown) => {
      if (!(error instanceof TakenMeanwhile)) throw error;
      const now = await channelListingRepository.forSettle(input.listingIds, orgId);
      const taken = now.find((r) => r.productId || r.leftOffAt);
      throw taken
        ? settledMeanwhile(taken)
        : new ConflictError("This listing was just settled. Nothing was changed.", { field: "listingIds" });
    });

    return { ...result, archived, mode: matching ? "match" : "new" };
  },

  /** A SKU another product holds, archived included, refuses with that product named (journey 4). */
  async assertSkuFree(orgId: string, rows: readonly SettleRow[], sku: string): Promise<void> {
    if (!rows.some((r) => r.sku === sku)) throw new DomainError("Pick the SKU of one of these listings.", { status: 400, field: "sku" });
    const owner = (await productService.listForMatching(orgId)).find((p) => p.sku === sku);
    if (owner) {
      throw new ConflictError(
        `SKU ${sku} is already used by ${owner.name}${owner.archived ? " (archived)" : ""}. Pick another SKU, or match to that product.`,
        { field: "sku" },
      );
    }
  },

  /** One listing per marketplace per product (Q22), said before the index has to. */
  async assertNotLinkedHere(rows: readonly SettleRow[], productId: string, productName: string): Promise<void> {
    for (const row of rows) {
      if ((await channelListingRepository.productIdsLinkedOn(row.connectionId)).has(productId)) {
        const label = CHANNEL_LABELS[row.channel as MarketplaceChannel];
        throw new ConflictError(`${productName} is already linked to another ${label} listing. Unlink that one first.`);
      }
    }
  },

  /** The worker's copy (D6): re-read, fetch each allowed photo, count, then attach in order. */
  async copyPhotos(payload: ListingPhotosPayload): Promise<{ done: number; failed: number }> {
    const [row] = await channelListingRepository.forSettle([payload.listingId], payload.orgId);
    if (!row || row.productId !== payload.productId) return { done: 0, failed: 0 };
    let urls: string[];
    try {
      urls = copyablePhotos((await detailOf(row)).photoUrls).slice(payload.skipFirst ? 1 : 0);
    } catch (error) {
      // The marketplace would not say what the photos are: every one counts as failed, so Try again shows.
      await channelListingRepository.photoProgress(row.id, 0, Math.max(row.photoTotal ?? 1, 1), new Date());
      throw error;
    }
    await channelListingRepository.startPhotoCopy(prisma, row.id, urls.length, payload.mode, new Date());
    const refs: string[] = [];
    let failed = 0;
    for (const url of urls) {
      try {
        refs.push(await mediaImportService.fromUrl(payload.orgId, null, url));
      } catch {
        failed++;
      }
      await channelListingRepository.photoProgress(row.id, refs.length, failed, new Date());
    }
    // A match replaces the gallery only when every photo arrived (D6); a new product takes what came.
    if (payload.mode === PHOTO_COPY_MODE.APPEND || failed === 0) {
      await productService.setImages(payload.productId, payload.orgId, refs, payload.mode);
    }
    return { done: refs.length, failed };
  },

  /** Try again on the photos that failed (Q21): the whole copy runs again; stored copies are reused. */
  async retryPhotos(orgId: string, listingId: string): Promise<void> {
    const [row] = await channelListingRepository.forSettle([listingId], orgId);
    if (!row || !row.productId) throw new NotFoundError("Linked listing");
    // The same kind of copy as the first: a match still replaces, and only when all arrive (D6).
    const mode = row.photoMode === PHOTO_COPY_MODE.REPLACE ? PHOTO_COPY_MODE.REPLACE : PHOTO_COPY_MODE.APPEND;
    await prisma.$transaction(async (tx) => {
      await channelListingRepository.startPhotoCopy(tx, row.id, 1, mode, new Date());
      const payload: ListingPhotosPayload = {
        orgId,
        listingId: row.id,
        productId: row.productId!,
        mode,
        skipFirst: false,
      };
      await enqueue(tx, listingPhotosSpec, payload);
    });
  },
};
