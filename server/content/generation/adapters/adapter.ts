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

/**
 * The largest picture we accept from a provider (review, 2026-11-21): a 2K PNG is a few megabytes,
 * so this is generous, and it stops a broken or hostile answer from filling the worker's memory.
 */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Read a body, refusing it once it passes the cap rather than after it is all in memory. */
async function readCapped(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, `picture of ${declared} bytes`);
  if (!response.body) return Buffer.from(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, "picture larger than the cap");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

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

/**
 * `fetch` bounded by the generation timeout. A connection that never opened is UNAVAILABLE; a
 * timeout is UNCERTAIN, because the provider may already be painting — and billing — the picture.
 */
export async function boundedFetch(url: string, init: RequestInit): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS) }).catch((cause: unknown) => {
    const name = cause instanceof Error ? cause.name : "network";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    throw new GenerationFailure(timedOut ? GENERATION_FAILURE.UNCERTAIN : GENERATION_FAILURE.UNAVAILABLE, name);
  });
}

/** The answer's body, or the classified failure if it was not a 2xx. */
export async function okOrFail(response: Response): Promise<Response> {
  if (response.ok) return response;
  // An error body is read only far enough to classify it.
  throw classifyHttp(response.status, (await response.text().catch(() => "")).slice(0, 2_000));
}

/**
 * A picture a provider linked to rather than sent: one more bounded fetch. The picture exists and
 * was paid for, so any failure here is UNCERTAIN, never a reason to ask another model (trd D6).
 */
export async function fetchLinked(url: string): Promise<Buffer> {
  try {
    // Only a secure link is followed: a provider's answer is not a reason to call anywhere else.
    if (!/^https:\/\//i.test(url)) throw new Error("picture link is not https");
    return await readCapped(await okOrFail(await boundedFetch(url, {})));
  } catch (cause) {
    throw new GenerationFailure(GENERATION_FAILURE.UNCERTAIN, `made but not fetched: ${String(cause)}`);
  }
}

/** Base64 to bytes, or BAD_OUTPUT when there is nothing to decode. */
export function decodeImage(base64: unknown): Buffer {
  if (typeof base64 !== "string" || base64.length === 0) {
    throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, "no image in the reply");
  }
  // Base64 is 4 characters per 3 bytes: the same cap as a linked picture.
  if (base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64) {
    throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, "picture larger than the cap");
  }
  return Buffer.from(base64.replace(/^data:[^,]+,/, ""), "base64");
}

export const dataUrl = (reference: GenerationReference) =>
  `data:${reference.mimeType};base64,${reference.bytes.toString("base64")}`;
