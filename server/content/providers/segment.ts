import type { EnhancementProvider } from "@server/content/enhancement.types";

/**
 * Cutting the product out of its background — one capability, one interface, two services behind it
 * (image-enhancement trd D3). Everything a service needs arrives as an argument, and nothing outside
 * `server/content/providers/` names one: which performs a run is configuration and a bake-off, never
 * a rewrite (spec R8).
 */
export interface SegmentInput {
  /** The photograph's stored bytes, for a service that takes an upload rather than a URL. */
  bytes: Buffer;
  /** Where those bytes live in the object store; null where the caller has bytes and nothing else. */
  objectKey: string | null;
  mimeType: string | null;
}

export interface Segmenter {
  /** What the ledger records as having performed the run (spec R9). */
  key: EnhancementProvider;
  /** Whether this service is configured and reachable at all — asked before it is chosen, never after. */
  isAvailable(): boolean;
  /** PNG bytes with an alpha channel: the product kept, everything else transparent. */
  cutOut(input: SegmentInput): Promise<Buffer>;
}

/** How a stored key becomes a URL, handed in so no service here reaches into the catalog itself. */
export interface StoreUrls {
  /** Where stored objects are publicly readable from, without a trailing slash. */
  base: string;
  /** One stored key's public URL, with each path segment encoded. */
  urlOf: (key: string) => string;
}

/**
 * Every call out of this directory is bounded. A worker waiting on a service that has stopped
 * answering holds a job slot for as long as the socket stays open, which is how one bad afternoon
 * at a provider becomes a stalled queue.
 */
export const SEGMENT_TIMEOUT_MS = 30_000;

/**
 * What the org member is told when a service fails. Deliberately the same sentence whichever one it
 * was and whatever it said: the choice of service is the platform's business (spec R8), and a
 * vendor's own error text is nobody's idea of a shop-owner's language.
 */
export const SEGMENT_FAILED_MESSAGE = "The background could not be removed just now. Try again in a moment.";
