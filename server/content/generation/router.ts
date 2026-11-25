import {
  FALLS_THROUGH,
  GENERATION_FAILURE,
  GenerationFailure,
  type GenerationAspect,
  type GenerationPurpose,
  type GenerationSize,
  type TextPurpose,
} from "@server/content/generation/generation.types";
import {
  DEFAULT_MODELS,
  DEFAULT_TEXT_MODELS,
  modelById,
  textModelById,
  type ModelEntry,
  type TextModelEntry,
} from "@server/content/generation/registry";
import { ADAPTERS } from "@server/content/generation/adapters";
import type { AdapterCall, TextAnswer, TextCall } from "@server/content/generation/adapters/adapter";
import { MODEL_ORDER_SOURCES, type ModelOrderSource } from "@server/content/generation/model-order";

/**
 * Which model answers (generation-foundation trd D4; ai-images Q10, Q12). The list for a purpose is
 * the first model-order source that has one (`model-order.ts`), else the default in the registry;
 * an id the registry does not know is skipped with a log line rather than crashing a run over a typo.
 */
async function ordered<M>(
  purpose: GenerationPurpose | TextPurpose,
  defaults: readonly string[],
  byId: (id: string) => M | undefined,
  sources: readonly ModelOrderSource[],
): Promise<M[]> {
  let ids: readonly string[] = defaults;
  for (const source of sources) {
    const order = await source.orderFor(purpose);
    if (order) {
      ids = order;
      break;
    }
  }
  const models: M[] = [];
  for (const id of ids) {
    const model = byId(id);
    if (model) models.push(model);
    else console.warn(`[generation] ${purpose}: unknown model id "${id}" in the model list, skipped`);
  }
  return models;
}

export async function orderedModels(
  purpose: GenerationPurpose,
  sources: readonly ModelOrderSource[] = MODEL_ORDER_SOURCES,
): Promise<ModelEntry[]> {
  return await ordered(purpose, DEFAULT_MODELS[purpose], modelById, sources);
}

/** A text purpose's models, read from the same sources as a picture's (ADR-0087 D2). */
export async function orderedTextModels(
  purpose: TextPurpose,
  sources: readonly ModelOrderSource[] = MODEL_ORDER_SOURCES,
): Promise<TextModelEntry[]> {
  return await ordered(purpose, DEFAULT_TEXT_MODELS[purpose], textModelById, sources);
}

/** The text models that could answer, in order: configured, and their adapter speaks text. */
export async function eligibleTextModels(purpose: TextPurpose): Promise<TextModelEntry[]> {
  return (await orderedTextModels(purpose)).filter((model) => {
    const adapter = ADAPTERS[model.adapter];
    return adapter.isConfigured() && adapter.callText !== undefined;
  });
}

export interface Ask {
  references: number;
  aspect: GenerationAspect;
  size: GenerationSize;
}

/** Whether a model can take this request at all: configured, enough references, the shape and size. */
export function canTake(model: ModelEntry, ask: Ask): boolean {
  return (
    ADAPTERS[model.adapter].isConfigured() &&
    model.maxReferences >= ask.references &&
    model.aspects.includes(ask.aspect) &&
    model.sizes.includes(ask.size)
  );
}

/** The models that could answer, in order. Empty means nothing is set up for this request. */
export async function eligibleModels(purpose: GenerationPurpose, ask: Ask): Promise<ModelEntry[]> {
  return (await orderedModels(purpose)).filter((model) => canTake(model, ask));
}

/** The most references the first configured model for this purpose takes — what a form says "up to N". */
export async function maxReferencesFor(purpose: GenerationPurpose): Promise<number> {
  const configured = (await orderedModels(purpose)).filter((model) => ADAPTERS[model.adapter].isConfigured());
  return configured[0]?.maxReferences ?? 0;
}

export interface Answered {
  model: ModelEntry;
  image: Buffer;
}

/**
 * Try each eligible model in order. A model that is unavailable or out of credit passes the request
 * on; a refusal or an unreadable answer ends it, because a refused prompt shopped around until
 * something says yes is a refusal ignored (spec R5).
 */
async function routeEach<M extends { id: string }, A>(models: readonly M[], ask: (model: M) => Promise<A>): Promise<A> {
  let last: GenerationFailure = new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no model can take this request");
  for (const model of models) {
    try {
      return await ask(model);
    } catch (cause) {
      const kind = cause instanceof GenerationFailure ? cause.kind : GENERATION_FAILURE.BAD_OUTPUT;
      const failure = new GenerationFailure(kind, cause instanceof GenerationFailure ? cause.detail : String(cause), model.id);
      console.warn(`[generation] ${model.id}: ${failure.kind} ${failure.detail}`);
      if (!FALLS_THROUGH.includes(failure.kind)) throw failure;
      last = failure;
    }
  }
  throw last;
}

export async function routeCall(models: readonly ModelEntry[], call: AdapterCall): Promise<Answered> {
  return await routeEach(models, async (model) => ({ model, image: await ADAPTERS[model.adapter].call(model, call) }));
}

export interface TextAnswered extends TextAnswer {
  model: TextModelEntry;
}

/** The same rule for text: on to the next model only when one is unavailable (ADR-0087 D2). */
export async function routeTextCall(models: readonly TextModelEntry[], call: TextCall): Promise<TextAnswered> {
  return await routeEach(models, async (model) => {
    const adapter = ADAPTERS[model.adapter];
    if (!adapter.callText) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "adapter speaks no text");
    return { model, ...(await adapter.callText(model, call)) };
  });
}
