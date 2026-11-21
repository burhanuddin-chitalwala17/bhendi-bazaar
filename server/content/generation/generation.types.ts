/**
 * The generation port (ai-images/generation-foundation trd D1). Everything a caller says to an image
 * model and everything it hears back, in our own words: no provider's field name appears here, and
 * nothing here knows what an enhancement, a listing or a social post is.
 */

/** What a picture is for. Each purpose has its own ordered model list (trd D4). */
export const GENERATION_PURPOSE = {
  /** A backdrop painted around a cut-out; the product is pasted back over it. */
  SCENE: "scene",
  /** A styled picture of the product for a listing (improve-with-ai). */
  LISTING: "listing",
} as const;
export type GenerationPurpose = (typeof GENERATION_PURPOSE)[keyof typeof GENERATION_PURPOSE];

/** Width over height, as the platform names it; each adapter spells it in its provider's terms. */
export const GENERATION_ASPECT = {
  SQUARE: "1:1",
  PORTRAIT: "4:5",
  TALL: "9:16",
  LANDSCAPE: "4:3",
} as const;
export type GenerationAspect = (typeof GENERATION_ASPECT)[keyof typeof GENERATION_ASPECT];

/** The long edge of the picture, in steps every provider offers. */
export const GENERATION_SIZE = { S1K: "1K", S2K: "2K" } as const;
export type GenerationSize = (typeof GENERATION_SIZE)[keyof typeof GENERATION_SIZE];

/** Long edge in pixels for each size, for pricing by tile or megapixel. */
export const SIZE_LONG_EDGE: Record<GenerationSize, number> = {
  [GENERATION_SIZE.S1K]: 1024,
  [GENERATION_SIZE.S2K]: 2048,
};

/** Width and height a size and aspect make, rounded to the 16-pixel grid image models work in. */
export function pixelsFor(aspect: GenerationAspect, size: GenerationSize): { width: number; height: number } {
  const [w, h] = aspect.split(":").map(Number) as [number, number];
  const long = SIZE_LONG_EDGE[size];
  const grid = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  return w >= h ? { width: long, height: grid((long * h) / w) } : { width: grid((long * w) / h), height: long };
}

/**
 * How a call can end other than with a picture, classified by the adapter so the router can act
 * without reading a vendor's words (trd D2, D4). Only the first two move to the next model.
 */
export const GENERATION_FAILURE = {
  /** Network, timeout, 5xx, rate limit: another model may answer. */
  UNAVAILABLE: "UNAVAILABLE",
  /** The account behind this model has no credit: another model may answer. */
  NO_CREDIT: "NO_CREDIT",
  /** The provider's safety check refused the content. Never routed around (spec R5). */
  REFUSED: "REFUSED",
  /** Something came back that is not a picture. */
  BAD_OUTPUT: "BAD_OUTPUT",
  /**
   * The request may have been accepted and billed but no picture reached us: a timeout after the
   * request was sent, or a made picture we could not fetch. Never passed on, because the next model
   * would be paid as well; the model's price is recorded as spent (trd D6).
   */
  UNCERTAIN: "UNCERTAIN",
} as const;
export type GenerationFailureKind = (typeof GENERATION_FAILURE)[keyof typeof GENERATION_FAILURE];

/** The failures after which the router tries the next model. */
export const FALLS_THROUGH: readonly GenerationFailureKind[] = [GENERATION_FAILURE.UNAVAILABLE, GENERATION_FAILURE.NO_CREDIT];

/** A classified failure from an adapter. `detail` is for the log, never for a person. */
export class GenerationFailure extends Error {
  constructor(
    readonly kind: GenerationFailureKind,
    readonly detail: string,
    /** The model that failed this way, set by the router, so the ledger can name it and price it. */
    readonly modelId: string | null = null,
  ) {
    super(`${kind}: ${detail}`);
    this.name = "GenerationFailure";
  }
}

/** One reference image. The subject — the photo being improved — is always first. */
export interface GenerationReference {
  bytes: Buffer;
  mimeType: string;
  /** The library image it came from, recorded on the ledger; null for an intermediate (a cut-out). */
  assetId: string | null;
}

/** What a caller asks for (spec R1). */
export interface GenerationRequest {
  purpose: GenerationPurpose;
  /** The composed prompt: the platform's words, with any brief from the shop inside its marked section. */
  prompt: string;
  /** Which platform prompt produced it (trd D9), e.g. `scene.v1`. */
  promptVersion: string;
  /** The shop's own words, recorded apart from the platform's; null when there were none. */
  brief: string | null;
  references: GenerationReference[];
  aspect: GenerationAspect;
  size: GenerationSize;
  /** One key per picture wanted; a retry with the same key never pays twice (spec R7). */
  idempotencyKey: string;
  /** Whether the picture is asked to show a person, for the record publishing reads. */
  containsPerson: boolean;
  /** The enhancement run this serves, for the ledger. */
  enhancementId: string | null;
}

/** What comes back (spec R6). */
export interface GenerationResult {
  generationId: string;
  images: Buffer[];
  modelId: string;
  costMicroUsd: number;
  costPaise: number;
}

/** What a picture will cost before it is asked for: the first model that would run. */
export interface GenerationQuote {
  modelId: string;
  maxReferences: number;
  costMicroUsd: number;
  costPaise: number;
}
