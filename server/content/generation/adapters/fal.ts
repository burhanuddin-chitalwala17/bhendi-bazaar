import { GENERATION_FAILURE, GenerationFailure } from "@server/content/generation/generation.types";
import { ADAPTER } from "@server/content/generation/registry";
import {
  boundedFetch,
  dataUrl,
  fetchLinked,
  okOrFail,
  type Adapter,
} from "@server/content/generation/adapters/adapter";
import { modelApiKey, modelEndpoint } from "@server/content/providers/model-host";

/**
 * fal, the account the platform already has (generation-foundation trd D8). Bria's product shot is
 * the scene's fallback: the cut-out as a data URL, the setting as words, a link back. Its key and
 * host are read where they always were, `providers/model-host.ts`, shared with the cut-out service.
 */
export const falAdapter: Adapter = {
  key: ADAPTER.FAL,
  isConfigured: () => modelApiKey() !== undefined,
  async call(model, input) {
    const key = modelApiKey();
    if (!key) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "not configured");
    const subject = input.references[0];
    if (!subject) throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, "a product shot needs the cut-out");
    const answer = await okOrFail(
      await boundedFetch(`${modelEndpoint()}${model.path}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Key ${key}` },
        body: JSON.stringify({
          image_url: dataUrl(subject),
          scene_description: input.prompt,
          aspect_ratio: input.aspect,
        }),
      }),
    );
    const reply = (await answer.json().catch(() => null)) as {
      images?: Array<{ url?: unknown }>;
      image?: { url?: unknown };
    } | null;
    const url = reply?.image?.url ?? reply?.images?.[0]?.url;
    if (typeof url !== "string" || url.length === 0) {
      throw new GenerationFailure(GENERATION_FAILURE.BAD_OUTPUT, "no image link in the reply");
    }
    return await fetchLinked(url);
  },
};
