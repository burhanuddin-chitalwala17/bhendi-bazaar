/** One of our types and kinds, with the marketplace types it is read from (marketplace-facts Q26). */
export interface ChannelTypeMapping {
  productType: string;
  typeLabel: string;
  kind: string | null;
  rows: Array<{ id: string; theirCategory: string; theirLabel: string | null; publishes: boolean; checkedOn: string }>;
}

/** Where a fill takes its value from the product (setup-requests D6, Q32). */
export const ATTRIBUTE_SOURCE = { SKU: "sku", NAME: "name", BRAND: "brand" } as const;
export type AttributeSource = (typeof ATTRIBUTE_SOURCE)[keyof typeof ATTRIBUTE_SOURCE];
