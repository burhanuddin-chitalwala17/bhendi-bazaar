import { GENERATION_FAILURE, GenerationFailure, pixelsFor } from "@server/content/generation/generation.types";
import { ADAPTER, DIALECT, type ModelEntry } from "@server/content/generation/registry";
import {
  boundedFetch,
  dataUrl,
  decodeImage,
  fetchLinked,
  looksRefused,
  okOrFail,
  type Adapter,
  type AdapterCall,
} from "@server/content/generation/adapters/adapter";

/**
 * Cloudflare's AI platform: its own hosted models and the third-party models it resells, through one
 * account (generation-foundation trd D2, D5; INTEGRATIONS "Image generation"). Two dialects:
 *
 * - **Third-party** (`google/…`): JSON `{ model, input }` to `/ai/run`; the reply is
 *   `{ state, result: { image: <url> } }`, a link fetched once more.
 * - **Hosted** (`@cf/…`): multipart to `/ai/run/@cf/<model>`; the reply is base64 in JSON. The field
 *   names below are the hosted FLUX.2 form's and are confirmed against a live call before merge,
 *   because the schema page does not name them (INTEGRATIONS).
 */
const API = "https://api.cloudflare.com/client/v4/accounts";

function credentials(): { account: string; token: string } | null {
  const account = process.env.IMAGE_GEN_ACCOUNT_ID?.trim();
  const token = process.env.IMAGE_GEN_API_TOKEN?.trim();
  return account && token ? { account, token } : null;
}

async function thirdParty(base: string, token: string, model: ModelEntry, input: AdapterCall): Promise<Buffer> {
  const answer = await okOrFail(
    await boundedFetch(`${base}/ai/run`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: model.path,
        input: {
          prompt: input.prompt,
          image_input: input.references.map(dataUrl),
          aspect_ratio: input.aspect,
          image_size: input.size,
          output_format: "png",
        },
      }),
    }),
  );
  const reply = (await answer.json().catch(() => null)) as {
    state?: unknown;
    result?: { image?: unknown };
    errors?: Array<{ message?: unknown }>;
  } | null;
  const url = reply?.result?.image;
  if (typeof url === "string" && url.length > 0) return await fetchLinked(url);
  const said = JSON.stringify(reply?.errors ?? reply?.state ?? "");
  throw new GenerationFailure(looksRefused(said) ? GENERATION_FAILURE.REFUSED : GENERATION_FAILURE.BAD_OUTPUT, said.slice(0, 200));
}

async function hosted(base: string, token: string, model: ModelEntry, input: AdapterCall): Promise<Buffer> {
  const { width, height } = pixelsFor(input.aspect, input.size);
  const form = new FormData();
  form.set("prompt", input.prompt);
  form.set("width", String(width));
  form.set("height", String(height));
  if (model.steps) form.set("steps", String(model.steps));
  input.references.forEach((reference, index) => {
    form.set(`input_image_${index}`, new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }), `ref-${index}`);
  });
  const answer = await okOrFail(
    await boundedFetch(`${base}/ai/run/${model.path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    }),
  );
  const reply = (await answer.json().catch(() => null)) as {
    result?: { image?: unknown };
    errors?: Array<{ message?: unknown }>;
  } | null;
  if (reply?.result?.image) return decodeImage(reply.result.image);
  const said = JSON.stringify(reply?.errors ?? "");
  throw new GenerationFailure(looksRefused(said) ? GENERATION_FAILURE.REFUSED : GENERATION_FAILURE.BAD_OUTPUT, said.slice(0, 200));
}

export const gatewayAdapter: Adapter = {
  key: ADAPTER.GATEWAY,
  isConfigured: () => credentials() !== null,
  async call(model, input) {
    const creds = credentials();
    if (!creds) throw new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "not configured");
    const base = `${API}/${encodeURIComponent(creds.account)}`;
    return model.dialect === DIALECT.GATEWAY_HOSTED
      ? await hosted(base, creds.token, model, input)
      : await thirdParty(base, creds.token, model, input);
  },
};
