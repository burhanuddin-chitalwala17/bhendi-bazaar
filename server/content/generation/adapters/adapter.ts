import {
  GENERATION_FAILURE,
  GenerationFailure,
  type GenerationAspect,
  type GenerationReference,
  type GenerationSize,
} from "@server/content/generation/generation.types";
import type { AdapterKey, ModelEntry } from "@server/content/generation/registry";

/**
 * One provider's API (generation-foundation trd D2). An adapter is the only code that knows a
 * provider's host, its field names and how it says no; everything it returns is in our terms.
 */
export interface AdapterCall {
  prompt: string;
  references: GenerationReference[];
  aspect: GenerationAspect;
  size: GenerationSize;
}

export interface Adapter {
  key: AdapterKey;
  /** Whether its credentials are set at all — asked before it is chosen, never after. */
  isConfigured(): boolean;
  /** One picture's bytes, or a `GenerationFailure`. */
  call(model: ModelEntry, input: AdapterCall): Promise<Buffer>;
}

/** A generation is slower than a transform; still bounded, or a dead socket holds a job slot. */
export const GENERATION_TIMEOUT_MS = 90_000;

/** Billing words a provider uses when an account is empty, whichever way it phrases it. */
const NO_CREDIT = /balance|credit|quota exceeded|billing|payment required|insufficient funds/i;
/** Words a provider uses when its safety check refused the content. */
const REFUSAL = /safety|blocked|content polic|moderation|nsfw|prohibited|refus/i;

/** One classification for every adapter's HTTP failures, so they cannot drift apart (trd D12). */
export function classifyHttp(status: number, body: string): GenerationFailure {
  if (status === 402 || NO_CREDIT.test(body)) return new GenerationFailure(GENERATION_FAILURE.NO_CREDIT, `${status}`);
  if (status === 429 || status >= 500) return new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, `${status}`);
  if (REFUSAL.test(body)) return new GenerationFailure(GENERATION_FAILURE.REFUSED, `${status}`);
  if (status === 401 || status === 403) return new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, `${status} credentials`);
  return new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, `${status}`);
}

/** A refusal reported inside a 200, which some providers do. */
export function looksRefused(text: string): boolean {
  return REFUSAL.test(text);
}

/** `fetch` bounded by the generation timeout, with a network error or abort as UNAVAILABLE. */
export async function boundedFetch(url: string, init: RequestInit): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS) }).catch((cause: unknown) => {
    throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, cause instanceof Error ? cause.name : "network");
  });
}

/** The answer's body, or the classified failure if it was not a 2xx. */
export async function okOrFail(response: Response): Promise<Response> {
  if (response.ok) return response;
  throw classifyHttp(response.status, await response.text().catch(() => ""));
}

/** A picture a provider linked to rather than sent: one more bounded fetch. */
export async function fetchLinked(url: string): Promise<Buffer> {
  const picture = await okOrFail(await boundedFetch(url, {}));
  return Buffer.from(await picture.arrayBuffer());
}

/** Base64 to bytes, or BAD_OUTPUT when there is nothing to decode. */
export function decodeImage(base64: unknown): Buffer {
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, "no image in the reply");
  }
  return Buffer.from(base64.replace(/^data:[^,]+,/, ""), "base64");
}

export const dataUrl = (reference: GenerationReference) =>
  `data:${reference.mimeType};base64,${reference.bytes.toString("base64")}`;
