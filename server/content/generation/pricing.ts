import {
  GENERATION_SIZE,
  pixelsFor,
  type GenerationAspect,
  type GenerationSize,
} from "@server/content/generation/generation.types";

/**
 * How a model is billed, in micro-dollars (millionths of a US dollar), so every price the providers
 * publish is a whole number and no arithmetic here is a float (Invariant 3; generation-foundation
 * trd D3, D7). Neither provider reports cost on a reply (INTEGRATIONS), so this is the only record.
 */
export type PriceRule =
  /** A flat price per picture by size, plus an optional price per reference sent. */
  | { kind: "perImage"; bySize: Record<GenerationSize, number>; perReference?: number }
  /** Per 512×512 tile in and out; per step when `steps` is set (the price multiplies by it). */
  | { kind: "perTile"; inputTile: number; outputTile: number; steps?: number }
  /** The first output megapixel, each further one, and each input megapixel. */
  | { kind: "perMegapixel"; firstMp: number; extraMp: number; inputMp: number };

/**
 * References are resized to at most this long edge before they are sent (generator), which is what
 * lets a quote equal the bill: a reference never costs more than one megapixel, or four tiles.
 */
export const REFERENCE_LONG_EDGE = 1024;
const TILE = 512 * 512;
const MEGAPIXEL = 1024 * 1024;
const REFERENCE_TILES = Math.ceil((REFERENCE_LONG_EDGE * REFERENCE_LONG_EDGE) / TILE);

const ceilDiv = (a: number, b: number) => Math.ceil(a / b);

/** What one picture costs, in micro-dollars, for this many references at this aspect and size. */
export function priceMicroUsd(rule: PriceRule, references: number, aspect: GenerationAspect, size: GenerationSize): number {
  const { width, height } = pixelsFor(aspect, size);
  const area = width * height;
  switch (rule.kind) {
    case "perImage":
      return rule.bySize[size] + (rule.perReference ?? 0) * references;
    case "perTile": {
      const tiles = ceilDiv(area, TILE) * rule.outputTile + references * REFERENCE_TILES * rule.inputTile;
      return tiles * (rule.steps ?? 1);
    }
    case "perMegapixel": {
      const outputMp = ceilDiv(area, MEGAPIXEL);
      return rule.firstMp + Math.max(0, outputMp - 1) * rule.extraMp + references * rule.inputMp;
    }
  }
}

/**
 * Micro-dollars to paise at a day's rate, rounded **up** to the whole paisa: the platform never
 * records spending less than it spent. Integers throughout; the product stays far inside 2^53.
 */
export function microUsdToPaise(microUsd: number, paisePerUsd: number): number {
  if (!Number.isInteger(microUsd) || !Number.isInteger(paisePerUsd)) {
    throw new Error("Money is integers: micro-dollars and paise per dollar");
  }
  return ceilDiv(microUsd * paisePerUsd, 1_000_000);
}

/** The size every caller uses unless it asks otherwise. */
export const DEFAULT_SIZE: GenerationSize = GENERATION_SIZE.S1K;
