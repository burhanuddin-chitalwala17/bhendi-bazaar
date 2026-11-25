import type { GenerationPurpose, TextPurpose } from "@server/content/generation/generation.types";

/**
 * Where a purpose's model order comes from (generation-foundation trd D4; ai-images Q12). Asked
 * in turn; the first that has an order for the purpose wins, and the registry's default is the
 * last word. Async because the admin screen parked in Q12 will read its order from a table: it
 * becomes one more source at the front of this list, and nothing that asks for an order changes.
 */
export interface ModelOrderSource {
  /** The model ids in the order to try them, or null where this source says nothing for the purpose. */
  orderFor(purpose: GenerationPurpose | TextPurpose): Promise<readonly string[] | null>;
}

/** The deployment's setting: `IMAGE_GEN_MODELS_<PURPOSE>`, comma-separated registry ids. */
export const environmentModelOrder: ModelOrderSource = {
  async orderFor(purpose) {
    const setting = process.env[`IMAGE_GEN_MODELS_${purpose.toUpperCase()}`]?.trim();
    if (!setting) return null;
    const ids = setting.split(",").map((id) => id.trim()).filter(Boolean);
    return ids.length > 0 ? ids : null;
  },
};

/** Consulted first to last. The admin screen's stored order will go at the front. */
export const MODEL_ORDER_SOURCES: readonly ModelOrderSource[] = [environmentModelOrder];
