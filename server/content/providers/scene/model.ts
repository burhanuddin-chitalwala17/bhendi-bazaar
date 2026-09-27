import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import { fetchPicture, modelApiKey, modelEndpoint } from "@server/content/providers/model-host";
import { SCENE_ASPECT, type SceneAspect } from "@server/content/scene-presets";
import {
  SCENE_FAILED_MESSAGE,
  SCENE_NO_CREDIT_MESSAGE,
  SCENE_TIMEOUT_MS,
  type ScenePaintInput,
  type ScenePainter,
} from "@server/content/providers/scene";

/**
 * A hosted model that paints a setting around a product (image-enhancement trd D3). Plain `fetch`
 * and no SDK, so the only thing configuration carries is the key and the host, both declared in
 * `model-host.ts` and named for what they buy rather than for who sells them (ADR-0037).
 *
 * **The cut-out goes as a data URL, not as an uploaded reference.** The other direction was the
 * obvious one — the segmenter sends a link, because the photograph it works on is already an
 * object in the store with a URL. A cut-out is not: it is an intermediate this run just computed
 * and nobody asked to keep. Publishing it to the store to hand a service a link would mean
 * writing a public object, remembering to delete it, and leaving one behind on every failure — a
 * lifecycle bought for nothing. It is bounded by the stored ceiling (ADR-0026), so one request
 * carries it and the run owns no object it did not mean to own.
 */
const SCENE_PATH = "/fal-ai/bria/product-shot";

/** Our two shapes in the service's own words, which is the only place they are spelled this way. */
const ASPECT_PARAM: Record<SceneAspect, string> = {
  [SCENE_ASPECT.SQUARE]: "1:1",
  [SCENE_ASPECT.PORTRAIT]: "4:5",
};

/** A refusal that waiting cannot fix: an unpaid account, whichever way the service phrases it. */
const NO_CREDIT = /balance|credit|quota|billing|payment required|exhausted/i;

function refusal(status: number, body: string): DomainError {
  const message = status === 402 || NO_CREDIT.test(body) ? SCENE_NO_CREDIT_MESSAGE : SCENE_FAILED_MESSAGE;
  return new DomainError(message, { cause: status });
}

/** What the model answers with: a link to the picture it made. Anything else is a failure. */
function sceneUrlOf(payload: unknown): string | null {
  const answer = payload as { images?: Array<{ url?: unknown }>; image?: { url?: unknown } } | null;
  const url = answer?.image?.url ?? answer?.images?.[0]?.url;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export function modelScenePainter(): ScenePainter {
  return {
    key: ENHANCEMENT_PROVIDER.MODEL,

    isAvailable() {
      return modelApiKey() !== undefined;
    },

    async paint(input: ScenePaintInput): Promise<Buffer> {
      const key = modelApiKey();
      if (!key) throw new DomainError(SCENE_FAILED_MESSAGE);

      const answer = await fetch(`${modelEndpoint()}${SCENE_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Key ${key}` },
        body: JSON.stringify({
          image_url: `data:image/png;base64,${input.cutout.toString("base64")}`,
          scene_description: input.prompt,
          aspect_ratio: ASPECT_PARAM[input.aspect],
        }),
        signal: AbortSignal.timeout(SCENE_TIMEOUT_MS),
      }).catch((cause: unknown) => {
        // A timeout arrives here as an abort, which is a failure like any other and never escapes.
        throw new DomainError(SCENE_FAILED_MESSAGE, { cause });
      });
      if (!answer.ok) throw refusal(answer.status, await answer.text().catch(() => ""));

      const sceneUrl = sceneUrlOf(await answer.json().catch(() => null));
      if (!sceneUrl) throw new DomainError(SCENE_FAILED_MESSAGE);

      // The answer is a link, not the bytes: one more fetch, bounded the same way.
      return await fetchPicture(sceneUrl, SCENE_TIMEOUT_MS, SCENE_FAILED_MESSAGE);
    },
  };
}
