import { productService } from "@server/catalog/product.service";
import { CHANNEL, type Channel } from "@server/shared/channels";

import { FIELD_REQUIREMENT } from "./channel-catalogue.types";
import { channelCatalogueRepository } from "./channel-catalogue.repository";
import { channelMapRepository } from "./channel-map.repository";
import { GAP_REASON } from "./field-map.types";
import { listingBuildService } from "./listing-build.service";
import { orgChannelService } from "./org-channel.service";
import { orgListingDefaultsService } from "./org-listing-defaults.service";
import { categoryFor } from "./shopfront-feed";
import { productChannelStateRepository, type ChannelStateRow } from "./product-channel-state.repository";

const BATCH = 500;
const COUNTED = new Set<string>([GAP_REASON.MISSING, GAP_REASON.UNMAPPED, GAP_REASON.NO_MATCH, GAP_REASON.DEVELOPER]);

/**
 * Each product's completeness per channel the shop sells on (listing-model/dynamic-form D3, R4): the same
 * build a send makes, its required gaps counted against what the channel requires. Batches of 500; run by
 * the refresh job, never on a page view.
 */
export const completenessService = {
  async refresh(orgId: string, productIds?: readonly string[], now = new Date()): Promise<number> {
    const ids = productIds ?? (await productService.listWithSku(orgId)).map((p) => p.id);
    const [choices, defaults] = await Promise.all([orgChannelService.list(orgId), orgListingDefaultsService.get(orgId)]);
    const channels = choices.filter((c) => c.enabled && c.channel !== CHANNEL.STORE).map((c) => c.channel);
    // The HSN a send takes for the product's category (listing-create inputFor).
    const hsnOf = (categoryId: string | null) => defaults.taxCodes.find((t) => t.categoryId === categoryId)?.taxCode ?? null;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      // An archived product holds no rows: it sells nowhere (review).
      const products = (await productService.forListing(orgId, batch)).filter((p) => p.archivedAt === null);
      const rows: ChannelStateRow[] = [];
      for (const channel of channels) rows.push(...(await this.forChannel(orgId, channel, products, hsnOf)));
      await productChannelStateRepository.replace(orgId, batch, rows, now);
    }
    return ids.length;
  },

  async forChannel(orgId: string, channel: Channel, products: Awaited<ReturnType<typeof productService.forListing>>, hsnOf: (categoryId: string | null) => string | null): Promise<ChannelStateRow[]> {
    // The publishing rows and the "not sold here" ones, so a kind marked not sold gets no row (readiness's categoryFor).
    const rules = (await channelMapRepository.byChannel(channel)).categories.filter((r) => r.publishes || r.notSold);
    const typeOf = (p: { productType: string | null; kind: string | null }) => {
      const verdict = categoryFor(rules, p.productType, p.kind);
      return verdict.sold ? verdict.category : null;
    };
    const items = products.flatMap((p) => {
      const channelType = typeOf(p);
      return channelType ? [{ channelType, product: {
        id: p.id, name: p.name, sku: p.sku ?? p.id, description: p.description, brand: p.brand?.name ?? null, weightKg: p.weight,
        barcode: p.barcode, productType: p.productType, kind: p.kind, facts: p.facts, measurements: p.measurements, hsn: hsnOf(p.categoryId),
      } }] : [];
    });
    if (items.length === 0) return [];
    const [{ built }, catalogue] = await Promise.all([
      listingBuildService.build(channel, items),
      channelCatalogueRepository.fieldsFor([...new Set(items.map((i) => i.channelType))].map((key) => ({ channel, key }))),
    ]);
    return items.flatMap(({ product, channelType }) => {
      const fields = catalogue.get(`${channel}:${channelType}`)?.fields;
      // A channel type never read says nothing of what it needs: no row, never a "Ready" it has not earned (review).
      if (!fields || fields.length === 0) return [];
      const requiredKeys = new Set(fields.filter((f) => f.requirement === FIELD_REQUIREMENT.REQUIRED && !f.adapterFills).map((f) => f.key));
      const gaps = (built.get(product.id)?.gaps ?? []).filter((g) => COUNTED.has(g.reason) && requiredKeys.has(g.field));
      return [{ productId: product.id, orgId, channel, required: requiredKeys.size, missing: gaps.length, missingKeys: gaps.map((g) => g.label) }];
    });
  },

  async forProduct(productId: string) {
    return await productChannelStateRepository.forProduct(productId);
  },

  async needsFor(orgId: string) {
    return await productChannelStateRepository.needsFor(orgId);
  },

};
