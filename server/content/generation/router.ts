import {
  FALLS_THROUGH,
  GENERATION_FAILURE,
  GenerationFailure,
  type GenerationAspect,
  type GenerationPurpose,
  type GenerationSize,
} from "@server/content/generation/generation.types";
import { DEFAULT_MODELS, modelById, type ModelEntry } from "@server/content/generation/registry";
import { ADAPTERS } from "@server/content/generation/adapters";
import type { AdapterCall } from "@server/content/generation/adapters/adapter";

/**
 * Which model answers (generation-foundation trd D4; ai-images Q10, Q12). The list for a purpose is
 * the setting `IMAGE_GEN_MODELS_<PURPOSE>` if set, else the default in the registry; an id the
 * registry does not know is skipped with a log line rather than crashing a run over a typo.
 */
export function orderedModels(purpose: GenerationPurpose): ModelEntry[] {
  const setting = process.env[`IMAGE_GEN_MODELS_${purpose.toUpperCase()}`]?.trim();
  const ids = setting ? setting.split(",").map((id) => id.trim()).filter(Boolean) : DEFAULT_MODELS[purpose];
  const models: ModelEntry[] = [];
  for (const id of ids) {
    const model = modelById(id);
    if (model) models.push(model);
    else console.warn(`[generation] ${purpose}: unknown model id "${id}" in the model list, skipped`);
  }
  return models;
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
export function eligibleModels(purpose: GenerationPurpose, ask: Ask): ModelEntry[] {
  return orderedModels(purpose).filter((model) => canTake(model, ask));
}

/** The most references any configured model for this purpose takes — what a form says "up to N". */
export function maxReferencesFor(purpose: GenerationPurpose): number {
  const configured = orderedModels(purpose).filter((model) => ADAPTERS[model.adapter].isConfigured());
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
export async function routeCall(models: readonly ModelEntry[], call: AdapterCall): Promise<Answered> {
  let last: GenerationFailure = new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "no model can take this request");
  for (const model of models) {
    try {
      return { model, image: await ADAPTERS[model.adapter].call(model, call) };
    } catch (cause) {
      const failure =
        cause instanceof GenerationFailure ? cause : new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, String(cause));
      console.warn(`[generation] ${model.id}: ${failure.kind} ${failure.detail}`);
      if (!FALLS_THROUGH.includes(failure.kind)) throw failure;
      last = failure;
    }
  }
  throw last;
}
