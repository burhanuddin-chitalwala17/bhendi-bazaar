import { GENERATION_FAILURE, GenerationFailure } from "@server/content/generation/generation.types";
import { ADAPTER } from "@server/content/generation/registry";
import {
  boundedFetch,
  decodeImage,
  looksRefused,
  okOrFail,
  type Adapter,
} from "@server/content/generation/adapters/adapter";

/**
 * Google's Gemini API directly (ai-images Q7), through the Interactions endpoint its image docs now
 * show (INTEGRATIONS): text and base64 images as `input`, shape and size in `response_format`, the
 * picture back as base64. Up to 14 references, where the gateway's route to the same model takes 3.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

const apiKey = () => process.env.IMAGE_GEN_GEMINI_API_KEY?.trim() || undefined;

/** The picture in a reply, wherever this API version puts it. */
function imageOf(reply: unknown): string | null {
  const r = reply as {
    output_image?: { data?: unknown };
    steps?: Array<{ content?: Array<{ type?: unknown; data?: unknown }> }>;
  } | null;
  if (typeof r?.output_image?.data === "string") return r.output_image.data;
  for (const step of r?.steps ?? []) {
    for (const block of step.content ?? []) {
      if (block.type === "image" && typeof block.data === "string") return block.data;
    }
  }
  return null;
}

export const geminiAdapter: Adapter = {
  key: ADAPTER.GEMINI,
  isConfigured: () => apiKey() !== undefined,
  async call(model, input) {
    const key = apiKey();
    if (!key) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "not configured");
    const answer = await okOrFail(
      await boundedFetch(ENDPOINT, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          model: model.path,
          input: [
            { type: "text", text: input.prompt },
            ...input.references.map((reference) => ({
              type: "image",
              mime_type: reference.mimeType,
              data: reference.bytes.toString("base64"),
            })),
          ],
          response_format: { type: "image", aspect_ratio: input.aspect, image_size: input.size },
        }),
      }),
    );
    const reply: unknown = await answer.json().catch(() => null);
    const image = imageOf(reply);
    if (image) return decodeImage(image);
    const said = JSON.stringify(reply ?? "").slice(0, 300);
    throw new GenerationFailure(looksRefused(said) ? GENERATION_FAILURE.REFUSED : GENERATION_FAILURE.BAD_OUTPUT, said);
  },
};
