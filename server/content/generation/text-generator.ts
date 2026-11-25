import { GenerationState } from "@prisma/client";
import { generationRepository } from "@server/content/generation.repository";
import {
  GENERATION_FAILURE,
  GenerationFailure,
  type TextGenerationRequest,
  type TextGenerationResult,
  type TextPurpose,
} from "@server/content/generation/generation.types";
import { microUsdToPaise, priceTextMicroUsd } from "@server/content/generation/pricing";
import { eligibleTextModels, routeTextCall, type TextAnswered } from "@server/content/generation/router";
import type { TextModelEntry } from "@server/content/generation/registry";
import type { DayRate } from "@server/content/exchange-rate.repository";
import { rateFor, storedRateOrFetch } from "@server/content/generation/exchange-rate";
import { IN_FLIGHT_MS } from "@server/content/generation/generator";

/**
 * The text half of the generation port (ADR-0087): the same ledger row, the same fallback rule and
 * cost recorded before anything else can fail, as `generator.ts` keeps for pictures.
 */

/** Chat templates and system tokens a provider adds around the prompt, generously. */
const TEMPLATE_TOKENS = 64;

/** No tokenizer makes more tokens than the prompt has bytes, so this bound is never under the bill. */
export function worstInputTokens(prompt: string): number {
  return Buffer.byteLength(prompt, "utf8") + TEMPLATE_TOKENS;
}

const worstMicroUsd = (model: TextModelEntry, prompt: string, maxOutputTokens: number) =>
  priceTextMicroUsd(model.price, worstInputTokens(prompt), maxOutputTokens);

const paiseAt = (microUsd: number, rate: DayRate | null) => (rate ? microUsdToPaise(microUsd, rate.paisePerUsd) : 0);

/** The first model's worst case and the worst of all eligible, in paise at today's rate. Null when nothing is set up. */
export async function quoteText(
  purpose: TextPurpose,
  prompt: string,
  maxOutputTokens: number,
): Promise<{ first: { modelId: string; costPaise: number }; worstCostPaise: number } | null> {
  const models = await eligibleTextModels(purpose);
  const [model] = models;
  if (!model) return null;
  const prices = models.map((candidate) => worstMicroUsd(candidate, prompt, maxOutputTokens));
  const priced = prices.some((price) => price > 0);
  const rate = priced ? await storedRateOrFetch() : null;
  if (priced && !rate) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no exchange rate stored");
  return {
    first: { modelId: model.id, costPaise: paiseAt(prices[0] ?? 0, rate) },
    worstCostPaise: Math.max(...prices.map((price) => paiseAt(price, rate))),
  };
}

async function recordSpend(rowId: string, model: TextModelEntry, microUsd: number, rate: DayRate | null): Promise<number> {
  const costPaise = paiseAt(microUsd, rate);
  await generationRepository.recordPaid(rowId, { modelId: model.id, costMicroUsd: microUsd, costPaise, rateDay: rate?.day ?? null });
  return costPaise;
}

export async function generateText(request: TextGenerationRequest, now: Date = new Date()): Promise<TextGenerationResult> {
  const { row, created } = await generationRepository.open({
    idempotencyKey: request.idempotencyKey,
    purpose: request.purpose,
    promptVersion: request.promptVersion,
    platformPrompt: request.prompt,
    brief: null,
    referenceAssetIds: [],
    aspect: null,
    size: null,
    containsPerson: false,
    enhancementId: null,
  });

  if (!created) {
    if (row.state === GenerationState.SUCCEEDED && row.modelId && row.outputText !== null) {
      return { generationId: row.id, text: row.outputText, modelId: row.modelId, costMicroUsd: row.costMicroUsd, costPaise: row.costPaise };
    }
    if (row.state === GenerationState.REFUSED) throw new GenerationFailure(GENERATION_FAILURE.REFUSED, row.error ?? "refused");
    if (row.state === GenerationState.FAILED) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, row.error ?? "failed");
    if (now.getTime() - row.createdAt.getTime() < IN_FLIGHT_MS) {
      throw new Error(`generation ${row.id} may still be in flight; retry later`);
    }
    await generationRepository.markRetriedAfterUnknown(row.id);
  }

  const models = await eligibleTextModels(request.purpose);
  const rate = await rateFor(now);
  let answered: TextAnswered;
  try {
    if (models.length === 0) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no model can take this request");
    if (!rate && models.some((model) => worstMicroUsd(model, request.prompt, request.maxOutputTokens) > 0)) {
      throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no exchange rate stored");
    }
    answered = await routeTextCall(models, { prompt: request.prompt, maxOutputTokens: request.maxOutputTokens });
  } catch (cause) {
    if (!(cause instanceof GenerationFailure)) throw cause;
    const model = cause.modelId ? models.find((candidate) => candidate.id === cause.modelId) : undefined;
    if (cause.kind === GENERATION_FAILURE.UNCERTAIN && model) {
      await recordSpend(row.id, model, worstMicroUsd(model, request.prompt, request.maxOutputTokens), rate);
    }
    await generationRepository.fail(row.id, cause.kind === GENERATION_FAILURE.REFUSED, cause.message, cause.modelId);
    throw cause;
  }

  // A count the provider did not report is charged at its bound: never recorded as less than spent.
  const costMicroUsd = priceTextMicroUsd(
    answered.model.price,
    answered.inputTokens ?? worstInputTokens(request.prompt),
    answered.outputTokens ?? request.maxOutputTokens,
  );
  const costPaise = await recordSpend(row.id, answered.model, costMicroUsd, rate);

  const text = answered.text.trim();
  if (!text) {
    const failure = new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, "empty text", answered.model.id);
    await generationRepository.fail(row.id, false, failure.message, answered.model.id);
    throw failure;
  }
  await generationRepository.succeedText(row.id, text);
  return { generationId: row.id, text, modelId: answered.model.id, costMicroUsd, costPaise };
}
