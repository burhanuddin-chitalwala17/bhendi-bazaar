import { channelCatalogueRepository } from "./channel-catalogue.repository";
import { fieldMapRepository } from "./field-map.repository";
import type { BuiltListing } from "./field-map.types";
import { buildChannelListing, mapsFor, type BuildProduct } from "./listing-builder";
import { ANSWER, FACTS, FACT_DECLARATIONS, parseStoredFacts, parseStoredMeasurements, type FactKey, type MeasureKey } from "./listing-facts";
import { listingValueRepository } from "./listing-value.repository";
import { productTypeRepository } from "./product-type.repository";
import { sizeLabelFor } from "./size-label";

/** What a listing is built from: the product's own columns, as catalog reads them for a listing. */
export interface ListingSource {
  id: string;
  name: string;
  sku: string;
  description: string;
  brand: string | null;
  weightKg: number | null;
  barcode: string | null;
  productType: string | null;
  kind: string | null;
  facts: unknown;
  measurements: unknown;
  hsn: string | null;
}

export interface ChannelBuild {
  /** Each product's built listing, by product id. */
  built: Map<string, BuiltListing>;
  /** Each channel type's stored JSON Schema, where the channel publishes one (field-maps D5, D6). */
  schemas: Map<string, unknown>;
}

const CHOICE_LISTS = [...new Set(FACTS.flatMap((f) => (FACT_DECLARATIONS[f].answer === ANSWER.CHOICE && FACT_DECLARATIONS[f].list ? [FACT_DECLARATIONS[f].list!] : [])))];

/**
 * Building channel listings for a batch (listing-model/field-maps D3, spec R5): every input — fields,
 * maps, labels, types — read once for the batch, then the pure builder per product (hazard *cost*).
 */
export const listingBuildService = {
  async build(channel: string, items: ReadonlyArray<{ product: ListingSource; channelType: string }>): Promise<ChannelBuild> {
    const types = [...new Set(items.map((i) => i.channelType))];
    const pairs = types.map((key) => ({ channel, key }));
    const [fields, maps, schemas, labels, bbTypes] = await Promise.all([
      channelCatalogueRepository.fieldsFor(pairs),
      fieldMapRepository.forTypes(types.map((channelType) => ({ channel, channelType }))),
      channelCatalogueRepository.schemas(pairs),
      listingValueRepository.byLists(CHOICE_LISTS, null),
      productTypeRepository.byKeys(items.map((i) => i.product.productType).filter((k): k is string => !!k)),
    ]);
    const labelOf = (attributeKey: string, optionKey: string) => {
      const list = FACT_DECLARATIONS[attributeKey as FactKey]?.list;
      return (list ? labels[list]?.find((o) => o.key === optionKey)?.label : undefined) ?? null;
    };
    const built = new Map<string, BuiltListing>();
    for (const { product, channelType } of items) {
      const type = product.productType ? (bbTypes.get(product.productType) ?? null) : null;
      const stored = parseStoredMeasurements(product.measurements);
      const measurements: BuildProduct["measurements"] = {};
      const plain: Partial<Record<MeasureKey, number>> = {};
      for (const [key, m] of Object.entries(stored) as Array<[MeasureKey, { value: number }]>) {
        const unit = type?.measures.find((d) => d.key === key)?.unit;
        plain[key] = m.value;
        if (unit) measurements[key] = { value: m.value, unit };
      }
      built.set(product.id, buildChannelListing({
        fields: fields.get(`${channel}:${channelType}`)?.fields ?? [],
        maps: mapsFor(maps.filter((m) => m.channelType === channelType), product.productType),
        labelOf,
        product: {
          name: product.name, sku: product.sku, description: product.description, brand: product.brand,
          weightKg: product.weightKg, barcode: product.barcode, kind: product.kind, hsn: product.hsn,
          facts: parseStoredFacts(product.facts), measurements, sizeLabel: sizeLabelFor(type, plain)?.label ?? null,
        },
      }));
    }
    return { built, schemas };
  },
};
