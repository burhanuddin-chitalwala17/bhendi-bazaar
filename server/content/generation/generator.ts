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
import { eligibleModels, routeCall, type Ask } from "@server/content/generation/router";
import { rateFor } from "@server/content/generation/exchange-rate";

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
 * What a picture will cost before it is asked for: the first model that could take it, at today's
 * rate. Null when nothing is set up to take it. Throws when a priced model has no rate to price at.
 */
export async function quote(purpose: GenerationPurpose, ask: Ask): Promise<GenerationQuote | null> {
  const [model] = eligibleModels(purpose, ask);
  if (!model) return null;
  const costMicroUsd = priceMicroUsd(model.price, ask.references, ask.aspect, ask.size);
  const rate = costMicroUsd > 0 ? await rateFor() : null;
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

export async function generate(request: GenerationRequest): Promise<GenerationResult> {
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
    // SUBMITTED by a worker that died mid-call: the provider may have billed; call again, visibly.
    await generationRepository.markRetriedAfterUnknown(row.id);
  }

  let modelId: string | null = null;
  try {
    const models = eligibleModels(request.purpose, ask);
    if (models.length === 0) {
      throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no model can take this request");
    }
    const rate = await rateFor();
    const priced = models.some((model) => priceMicroUsd(model.price, ask.references, ask.aspect, ask.size) > 0);
    if (priced && !rate) {
      // Refused before the call: a picture we cannot price in rupees is not one we pay for (Q13).
      throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no exchange rate stored");
    }
    const references = await Promise.all(request.references.map(normalise));
    const answered = await routeCall(models, {
      prompt: request.prompt,
      references,
      aspect: request.aspect,
      size: request.size,
    });
    modelId = answered.model.id;

    const costMicroUsd = priceMicroUsd(answered.model.price, ask.references, ask.aspect, ask.size);
    const costPaise = rate ? microUsdToPaise(costMicroUsd, rate.paisePerUsd) : 0;

    const image = await asPng(answered.image);
    const key = outputKey(row.id, 0);
    await mediaAssetService.putLooseObject(key, image, "image/png");
    await generationRepository.succeed(row.id, {
      modelId: answered.model.id,
      outputKeys: [key],
      costMicroUsd,
      costPaise,
      rateDay: rate?.day ?? null,
    });
    return { generationId: row.id, images: [image], modelId: answered.model.id, costMicroUsd, costPaise };
  } catch (cause) {
    const failure =
      cause instanceof GenerationFailure ? cause : new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, String(cause));
    await generationRepository.fail(row.id, failure.kind === GENERATION_FAILURE.REFUSED, failure.message, modelId);
    throw failure;
  }
}
