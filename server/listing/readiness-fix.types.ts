import type { Channel } from "@server/shared/channels";

/** The fix page for one channel and one missing fact (readiness-fix ux.md). */
export interface FixPageDTO {
  channel: Channel;
  channelLabel: string;
  fact: string;
  factLabel: string;
  options: Array<{ key: string; label: string }>;
  rows: FixRowDTO[];
  /** How many the channel would take now, and of how many, for "All done". */
  wouldGo: number;
  total: number;
}

export interface FixRowDTO {
  productId: string;
  name: string;
  sku: string | null;
  photoUrl: string | null;
  /** A marketplace's own word for the fact, as evidence only (Q6). */
  said: { channel: string; label: string; value: string } | null;
}

/** What a pick did: set, or left because the product already had an answer (Q5). */
export interface FixAnswerResultDTO {
  set: string[];
  skipped: string[];
}
