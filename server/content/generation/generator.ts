import sharp from "sharp";
import { GenerationState } from "@prisma/client";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { generationRepository } from "@server/content/generation.repository";
import {
  GENERATION_FAILURE,
  GenerationFailure,
  type GenerationPurpose,
  type GenerationQuote,
  type GenerationReference,
  type GenerationRequest,
  type GenerationResult,
} from "@server/content/generation/generation.types";
import { microUsdToPaise, priceMicroUsd, REFERENCE_LONG_EDGE } from "@server/content/generation/pricing";
import { eligibleModels, routeCall, type Answered, type Ask } from "@server/content/generation/router";
import type { ModelEntry } from "@server/content/generation/registry";
import { GENERATION_TIMEOUT_MS } from "@server/content/generation/adapters/adapter";
import type { DayRate } from "@server/content/exchange-rate.repository";
import { rateFor, storedRateOrFetch } from "@server/content/generation/exchange-rate";

/**
 * The generation port's one implementation (generation-foundation trd D1, D6). Callers say what
 * they want; this decides nothing about which provider — the router does — and keeps the ledger:
 * a row before the call, the picture stored before the row is marked done, so a retried job replays
 * instead of paying again (spec R7).
 */

/** Where a generation's pictures wait; one prefix, one object per picture, keyed by the row. */
export const GENERATION_PREFIX = "generations/";

const outputKey = (generationId: string, index: number) => `${GENERATION_PREFIX}${generationId}/${index}.png`;

/**
 * References are shrunk to the long edge pricing assumes before they leave, so a quote is the bill
 * (pricing.ts) and a 12-megapixel phone photo is not uploaded to be ignored. Transparency is kept:
 * a cut-out is a reference too.
 */
async function normalise(reference: GenerationReference): Promise<GenerationReference> {
  const bytes = await sharp(reference.bytes)
    .rotate()
    .resize({ width: REFERENCE_LONG_EDGE, height: REFERENCE_LONG_EDGE, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  return { ...reference, bytes, mimeType: "image/png" };
}

/** A picture in whatever format the model sent, stored as PNG so every output reads the same way. */
async function asPng(image: Buffer): Promise<Buffer> {
  return await sharp(image).png().toBuffer().catch((cause: unknown) => {
    throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, `not a picture: ${String(cause)}`);
  });
}

/**
 * The first model's price and the most any eligible model could cost, both in paise at today's
 * rate (shop-credits D5: the worst case is what is held). Null when nothing can take the request.
 */
export async function quoteRange(
  purpose: GenerationPurpose,
  ask: Ask,
): Promise<{ first: GenerationQuote; worstCostPaise: number } | null> {
  const models = await eligibleModels(purpose, ask);
  const [model] = models;
  if (!model) return null;
  const prices = models.map((candidate) => priceMicroUsd(candidate.price, ask.references, ask.aspect, ask.size));
  const rate = prices.some((price) => price > 0) ? await storedRateOrFetch() : null;
  if (prices.some((price) => price > 0) && !rate) {
    throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no exchange rate stored");
  }
  const paise = (microUsd: number) => (rate ? microUsdToPaise(microUsd, rate.paisePerUsd) : 0);
  return {
    first: { modelId: model.id, maxReferences: model.maxReferences, costMicroUsd: prices[0] ?? 0, costPaise: paise(prices[0] ?? 0) },
    worstCostPaise: Math.max(...prices.map(paise)),
  };
}

/**
 * What a picture will cost before it is asked for: the first model that could take it, at today's
 * rate. Null when nothing is set up to take it. Throws when a priced model has no rate to price at.
 */
export async function quote(purpose: GenerationPurpose, ask: Ask): Promise<GenerationQuote | null> {
  const [model] = await eligibleModels(purpose, ask);
  if (!model) return null;
  const costMicroUsd = priceMicroUsd(model.price, ask.references, ask.aspect, ask.size);
  const rate = costMicroUsd > 0 ? await storedRateOrFetch() : null;
  if (costMicroUsd > 0 && !rate) {
    throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no exchange rate stored");
  }
  return {
    modelId: model.id,
    maxReferences: model.maxReferences,
    costMicroUsd,
    costPaise: rate ? microUsdToPaise(costMicroUsd, rate.paisePerUsd) : 0,
  };
}

/**
 * A `SUBMITTED` row younger than this may still have a call in flight on another worker (a
 * redelivered job): calling again would pay twice, so the retry waits for the queue's next attempt.
 */
export const IN_FLIGHT_MS = 2 * GENERATION_TIMEOUT_MS;

/** The model's price, recorded as spent: a picture it made, or one it may have (UNCERTAIN). */
async function recordSpend(rowId: string, model: ModelEntry, ask: Ask, rate: DayRate | null): Promise<number> {
  const costMicroUsd = priceMicroUsd(model.price, ask.references, ask.aspect, ask.size);
  const costPaise = rate ? microUsdToPaise(costMicroUsd, rate.paisePerUsd) : 0;
  await generationRepository.recordPaid(rowId, { modelId: model.id, costMicroUsd, costPaise, rateDay: rate?.day ?? null });
  return costPaise;
}

export async function generate(request: GenerationRequest, now: Date = new Date()): Promise<GenerationResult> {
  const ask: Ask = { references: request.references.length, aspect: request.aspect, size: request.size };
  const { row, created } = await generationRepository.open({
    idempotencyKey: request.idempotencyKey,
    purpose: request.purpose,
    promptVersion: request.promptVersion,
    platformPrompt: request.prompt,
    brief: request.brief,
    referenceAssetIds: request.references.flatMap((reference) => (reference.assetId ? [reference.assetId] : [])),
    aspect: request.aspect,
    size: request.size,
    containsPerson: request.containsPerson,
    enhancementId: request.enhancementId,
  });

  if (!created) {
    if (row.state === GenerationState.SUCCEEDED && row.modelId) {
      const images = await Promise.all(row.outputKeys.map((key) => mediaAssetService.readLooseObject(key)));
      return { generationId: row.id, images, modelId: row.modelId, costMicroUsd: row.costMicroUsd, costPaise: row.costPaise };
    }
    if (row.state === GenerationState.REFUSED) throw new GenerationFailure(GENERATION_FAILURE.REFUSED, row.error ?? "refused");
    if (row.state === GenerationState.FAILED) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, row.error ?? "failed");
    if (now.getTime() - row.createdAt.getTime() < IN_FLIGHT_MS) {
      // Not a GenerationFailure: the queue retries it later, by which time the other call has ended.
      throw new Error(`generation ${row.id} may still be in flight; retry later`);
    }
    // SUBMITTED by a worker that died mid-call: the provider may have billed; call again, visibly.
    await generationRepository.markRetriedAfterUnknown(row.id);
  }

  const models = await eligibleModels(request.purpose, ask);
  const rate = await rateFor(now);
  let costPaise = 0;
  let answered: Answered;
  try {
    if (models.length === 0) {
      throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no model can take this request");
    }
    if (!rate && models.some((model) => priceMicroUsd(model.price, ask.references, ask.aspect, ask.size) > 0)) {
      // Refused before the call: a picture we cannot price in rupees is not one we pay for (Q13).
      throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no exchange rate stored");
    }
    const references = await Promise.all(request.references.map(normalise));
    answered = await routeCall(models, { prompt: request.prompt, references, aspect: request.aspect, size: request.size });
  } catch (cause) {
    if (!(cause instanceof GenerationFailure)) throw cause;
    const model = cause.modelId ? models.find((candidate) => candidate.id === cause.modelId) : undefined;
    if (cause.kind === GENERATION_FAILURE.UNCERTAIN && model) await recordSpend(row.id, model, ask, rate);
    await generationRepository.fail(row.id, cause.kind === GENERATION_FAILURE.REFUSED, cause.message, cause.modelId);
    throw cause;
  }

  // Paid: recorded before anything else can fail, so a storage error loses no money (trd D6).
  costPaise = await recordSpend(row.id, answered.model, ask, rate);
  const costMicroUsd = priceMicroUsd(answered.model.price, ask.references, ask.aspect, ask.size);

  let image: Buffer;
  try {
    image = await asPng(answered.image);
  } catch (cause) {
    const failure = cause instanceof GenerationFailure ? cause : new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, String(cause));
    await generationRepository.fail(row.id, false, failure.message, answered.model.id);
    throw failure;
  }
  // A storage error is not the model's failure: it escapes unwrapped for the queue to retry.
  const key = outputKey(row.id, 0);
  await mediaAssetService.putLooseObject(key, image, "image/png");
  await generationRepository.succeed(row.id, [key]);
  return { generationId: row.id, images: [image], modelId: answered.model.id, costMicroUsd, costPaise };
}
