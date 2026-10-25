/** One of our types and kinds, with the marketplace types it is read from (marketplace-facts Q26). */
export interface ChannelTypeMapping {
  productType: string;
  typeLabel: string;
  kind: string | null;
  rows: Array<{ id: string; theirCategory: string; theirLabel: string | null; publishes: boolean; checkedOn: string }>;
}
