import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import { SCENE_ASPECT, type SceneAspect } from "@server/content/scene-presets";
import {
  GENERATION_ASPECT,
  GENERATION_FAILURE,
  GENERATION_PURPOSE,
  GENERATION_SIZE,
  GenerationFailure,
  type GenerationAspect,
} from "@server/content/generation/generation.types";
import { generate } from "@server/content/generation/generator";
import { eligibleModels } from "@server/content/generation/router";
import { scenePrompt } from "@server/content/generation/prompts";
import {
  SCENE_FAILED_MESSAGE,
  SCENE_NO_CREDIT_MESSAGE,
  type ScenePaintInput,
  type ScenePainter,
} from "@server/content/providers/scene";

/**
 * The scene painter over the generation port (generation-foundation spec R8, trd D8; ai-images Q11).
 * Which model paints is the router's choice (the order is the registry's default or the
 * `IMAGE_GEN_MODELS_SCENE` setting); this file depends on no model or provider. What comes back is still only a backdrop: `tools/scene.ts` pastes the cut-out over
 * it and checks every product pixel, so a model that redrew the product is covered or refused.
 */
const ASPECT: Record<SceneAspect, GenerationAspect> = {
  [SCENE_ASPECT.SQUARE]: GENERATION_ASPECT.SQUARE,
  [SCENE_ASPECT.PORTRAIT]: GENERATION_ASPECT.PORTRAIT,
};

/** A model refused the setting's words — a platform prompt, so this is ours to fix, not the shop's. */
export const SCENE_REFUSED_MESSAGE = "This scene could not be painted. Try another setting.";

function messageFor(failure: GenerationFailure): string {
  if (failure.kind === GENERATION_FAILURE.NO_CREDIT) return SCENE_NO_CREDIT_MESSAGE;
  if (failure.kind === GENERATION_FAILURE.REFUSED) return SCENE_REFUSED_MESSAGE;
  return SCENE_FAILED_MESSAGE;
}

/**
 * A painter for one enhancement run: the run's id is the generation's idempotency key, so a resumed
 * run replays the backdrop it already paid for (spec R7).
 */
export function generatedScenePainter(runId: string): ScenePainter {
  return {
    key: ENHANCEMENT_PROVIDER.GENERATION,

    async isAvailable() {
      return (
        (await eligibleModels(GENERATION_PURPOSE.SCENE, {
          references: 1,
          aspect: GENERATION_ASPECT.SQUARE,
          size: GENERATION_SIZE.S1K,
        })).length > 0
      );
    },

    async paint(input: ScenePaintInput): Promise<Buffer> {
      const prompt = scenePrompt(input.prompt);
      try {
        const result = await generate({
          purpose: GENERATION_PURPOSE.SCENE,
          prompt: prompt.text,
          promptVersion: prompt.version,
          brief: null,
          references: [{ bytes: input.cutout, mimeType: "image/png", assetId: null }],
          aspect: ASPECT[input.aspect],
          size: GENERATION_SIZE.S1K,
          idempotencyKey: `enhancement:${runId}:scene`,
          containsPerson: false,
          enhancementId: runId,
        });
        const [image] = result.images;
        if (!image) throw new DomainError(SCENE_FAILED_MESSAGE);
        return image;
      } catch (cause) {
        if (cause instanceof GenerationFailure) throw new DomainError(messageFor(cause), { cause });
        throw cause;
      }
    },
  };
}
