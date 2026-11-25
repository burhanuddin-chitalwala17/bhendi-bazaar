import {
  GENERATION_ASPECT,
  GENERATION_PURPOSE,
  GENERATION_SIZE,
  type GenerationAspect,
  type GenerationPurpose,
  type GenerationSize,
  TEXT_PURPOSE,
  type TextPurpose,
} from "@server/content/generation/generation.types";
import type { PriceRule, TokenPrice } from "@server/content/generation/pricing";

/**
 * Every model the platform may call, as data (generation-foundation trd D3; ai-images Q6). One entry
 * per **route**: the same model through two providers is two entries, each with its own price and
 * reference limit. Adding a model is adding an entry; which ones run is the router's setting.
 * Every price carries the date and page it was read from — prices move, and an unsourced number is
 * one nobody can check.
 */

/** Our names for the provider APIs; each is one file in `adapters/`. */
export const ADAPTER = { GATEWAY: "gateway", GEMINI: "gemini", FAL: "fal" } as const;
export type AdapterKey = (typeof ADAPTER)[keyof typeof ADAPTER];

/** How an adapter must shape the call; one adapter may speak more than one dialect. */
export const DIALECT = {
  /** A third-party model through the gateway: JSON in, a URL back. */
  GATEWAY_JSON: "gateway-json",
  /** A model the gateway hosts itself: multipart in, base64 back. */
  GATEWAY_HOSTED: "gateway-hosted",
  GEMINI_INTERACTIONS: "gemini-interactions",
  FAL_PRODUCT_SHOT: "fal-product-shot",
  /** A text model the gateway hosts: chat messages in, `response` back (ADR-0087). */
  GATEWAY_TEXT: "gateway-text",
  GEMINI_TEXT: "gemini-generate-content",
} as const;
export type Dialect = (typeof DIALECT)[keyof typeof DIALECT];

export interface ModelEntry {
  /** Ours, stable, stored on every generation row. */
  id: string;
  adapter: AdapterKey;
  dialect: Dialect;
  /** The provider's own name for the model, used only by its adapter. */
  path: string;
  /** References it accepts, the subject included. */
  maxReferences: number;
  aspects: readonly GenerationAspect[];
  sizes: readonly GenerationSize[];
  price: PriceRule;
  /** For a model billed per step, the steps we send, so the price is known before the call. */
  steps?: number;
  /** Where the price and limits were read, and when. */
  checked: string;
}

const ALL_ASPECTS = Object.values(GENERATION_ASPECT);
const BOTH_SIZES = [GENERATION_SIZE.S1K, GENERATION_SIZE.S2K] as const;
const ONE_K = [GENERATION_SIZE.S1K] as const;

/** Gemini's documented flat prices; the gateway passes the same model's price through unchanged. */
const NANO_BANANA_PRO: PriceRule = {
  kind: "perImage",
  bySize: { [GENERATION_SIZE.S1K]: 134_000, [GENERATION_SIZE.S2K]: 134_000 },
  perReference: 1_100,
};
const NANO_BANANA_2: PriceRule = {
  kind: "perImage",
  bySize: { [GENERATION_SIZE.S1K]: 67_000, [GENERATION_SIZE.S2K]: 101_000 },
};

export const MODELS: readonly ModelEntry[] = [
  {
    id: "cf/flux-2-klein-4b",
    adapter: ADAPTER.GATEWAY,
    dialect: DIALECT.GATEWAY_HOSTED,
    path: "@cf/black-forest-labs/flux-2-klein-4b",
    // Field limits are not documented (INTEGRATIONS); one reference is all a scene sends.
    maxReferences: 1,
    aspects: ALL_ASPECTS,
    sizes: ONE_K,
    price: { kind: "perTile", inputTile: 59, outputTile: 287 },
    checked: "2026-11-20 developers.cloudflare.com/workers-ai/platform/pricing",
  },
  {
    id: "cf/flux-2-klein-9b",
    adapter: ADAPTER.GATEWAY,
    dialect: DIALECT.GATEWAY_HOSTED,
    path: "@cf/black-forest-labs/flux-2-klein-9b",
    // "Supports multi-reference editing" with no number published; 4 until a live call says more.
    maxReferences: 4,
    aspects: ALL_ASPECTS,
    sizes: BOTH_SIZES,
    price: { kind: "perMegapixel", firstMp: 15_000, extraMp: 2_000, inputMp: 2_000 },
    checked: "2026-11-20 developers.cloudflare.com/workers-ai/platform/pricing",
  },
  {
    id: "cf/flux-2-dev",
    adapter: ADAPTER.GATEWAY,
    dialect: DIALECT.GATEWAY_HOSTED,
    path: "@cf/black-forest-labs/flux-2-dev",
    maxReferences: 4,
    aspects: ALL_ASPECTS,
    sizes: ONE_K,
    // Billed per step; no default is published, so we send 28 and price 28.
    steps: 28,
    price: { kind: "perTile", inputTile: 210, outputTile: 410, steps: 28 },
    checked: "2026-11-20 developers.cloudflare.com/workers-ai/platform/pricing",
  },
  {
    id: "cf/nano-banana-pro",
    adapter: ADAPTER.GATEWAY,
    dialect: DIALECT.GATEWAY_JSON,
    path: "google/nano-banana-pro",
    maxReferences: 3,
    aspects: ALL_ASPECTS,
    sizes: BOTH_SIZES,
    price: NANO_BANANA_PRO,
    checked: "2026-11-20 developers.cloudflare.com/ai/models/google/nano-banana-pro",
  },
  {
    id: "gemini/nano-banana-pro",
    adapter: ADAPTER.GEMINI,
    dialect: DIALECT.GEMINI_INTERACTIONS,
    path: "gemini-3-pro-image",
    maxReferences: 14,
    aspects: ALL_ASPECTS,
    sizes: BOTH_SIZES,
    price: NANO_BANANA_PRO,
    checked: "2026-11-21 aistudio.google.com/docs/pricing (summary read; recheck)",
  },
  {
    id: "gemini/nano-banana-2",
    adapter: ADAPTER.GEMINI,
    dialect: DIALECT.GEMINI_INTERACTIONS,
    path: "gemini-3.1-flash-image",
    maxReferences: 14,
    aspects: ALL_ASPECTS,
    sizes: BOTH_SIZES,
    price: NANO_BANANA_2,
    checked: "2026-11-21 aistudio.google.com/docs/pricing (summary read; recheck)",
  },
  {
    id: "fal/bria-product-shot",
    adapter: ADAPTER.FAL,
    dialect: DIALECT.FAL_PRODUCT_SHOT,
    path: "/fal-ai/bria/product-shot",
    maxReferences: 1,
    aspects: [GENERATION_ASPECT.SQUARE, GENERATION_ASPECT.PORTRAIT],
    sizes: ONE_K,
    price: { kind: "perImage", bySize: { [GENERATION_SIZE.S1K]: 40_000, [GENERATION_SIZE.S2K]: 40_000 } },
    checked: "2026-09-28 image-enhancement trd D3 (≈$0.04)",
  },
];

/** The order each purpose tries models in when no setting says otherwise (Q11, trd D4). */
export const DEFAULT_MODELS: Record<GenerationPurpose, readonly string[]> = {
  [GENERATION_PURPOSE.SCENE]: ["cf/flux-2-klein-4b", "fal/bria-product-shot"],
  [GENERATION_PURPOSE.LISTING]: ["cf/nano-banana-pro", "gemini/nano-banana-pro", "cf/flux-2-klein-9b"],
  // Its own entry so a post picture's order can move without a listing's (social-posts D1, R2).
  [GENERATION_PURPOSE.SOCIAL]: ["cf/nano-banana-pro", "gemini/nano-banana-pro", "cf/flux-2-klein-9b"],
};

export function modelById(id: string): ModelEntry | undefined {
  return MODELS.find((model) => model.id === id);
}

/** A text model route (ADR-0087 D2): no shape, size or reference; priced per token. */
export interface TextModelEntry {
  id: string;
  adapter: AdapterKey;
  dialect: Dialect;
  path: string;
  price: TokenPrice;
  checked: string;
}

export const TEXT_MODELS: readonly TextModelEntry[] = [
  {
    id: "gemini/gemini-2.5-flash",
    adapter: ADAPTER.GEMINI,
    dialect: DIALECT.GEMINI_TEXT,
    path: "gemini-2.5-flash",
    // Thinking is turned off in the call, so output is the caption alone.
    price: { inputPerMillion: 300_000, outputPerMillion: 2_500_000 },
    checked: "2026-11-25 ai.google.dev/gemini-api/docs/pricing (summary read; recheck)",
  },
  {
    id: "cf/llama-3.3-70b",
    adapter: ADAPTER.GATEWAY,
    dialect: DIALECT.GATEWAY_TEXT,
    path: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    price: { inputPerMillion: 293_000, outputPerMillion: 2_253_000 },
    checked: "2026-11-25 developers.cloudflare.com/workers-ai/platform/pricing (summary read; recheck)",
  },
];

/** Gemini first for its Hindi; the gateway's Llama when Gemini is down (ai-images Q7). */
export const DEFAULT_TEXT_MODELS: Record<TextPurpose, readonly string[]> = {
  [TEXT_PURPOSE.CAPTION]: ["gemini/gemini-2.5-flash", "cf/llama-3.3-70b"],
};

export function textModelById(id: string): TextModelEntry | undefined {
  return TEXT_MODELS.find((model) => model.id === id);
}
