/**
 * One contract every adapter keeps (generation-foundation trd D2, D12): the same recorded answers —
 * a picture, a timeout, a 5xx, a rate limit, an empty account, a refusal, garbage — produce the same
 * classified outcome whichever provider said them. A new adapter joins `CASES` and must pass all of
 * it. `fetch` is stubbed throughout; nothing goes near a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERATION_FAILURE, GenerationFailure } from "@server/content/generation/generation.types";
import { modelById, type ModelEntry } from "@server/content/generation/registry";
import type { Adapter, AdapterCall } from "@server/content/generation/adapters/adapter";
import { gatewayAdapter } from "@server/content/generation/adapters/gateway";
import { geminiAdapter } from "@server/content/generation/adapters/gemini";
import { falAdapter } from "@server/content/generation/adapters/fal";

const PICTURE = Buffer.from("the painted picture");
const b64 = PICTURE.toString("base64");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const linked = { url: "https://cdn.test/out.png" };

interface Case {
  name: string;
  adapter: Adapter;
  model: string;
  env: Record<string, string>;
  /** The provider's own success reply, and whether the picture is then fetched from a link. */
  success: () => Response;
  viaLink: boolean;
  /** How this provider reports a refusal inside a 2xx. */
  refusedInBody: () => Response;
  /** The request, checked for the provider's own shape. */
  assertRequest: (url: string, init: RequestInit) => void;
}

const CASES: Case[] = [
  {
    name: "gateway, third-party model",
    adapter: gatewayAdapter,
    model: "cf/nano-banana-pro",
    env: { IMAGE_GEN_ACCOUNT_ID: "acct", IMAGE_GEN_API_TOKEN: "tok" },
    success: () => json({ state: "Completed", result: { image: linked.url } }),
    viaLink: true,
    refusedInBody: () => json({ state: "Failed", errors: [{ message: "Blocked by safety filter" }] }),
    assertRequest: (url, init) => {
      expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/ai/run");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
      const body = JSON.parse(String(init.body)) as { model: string; input: Record<string, unknown> };
      expect(body.model).toBe("google/nano-banana-pro");
      expect(body.input).toMatchObject({ prompt: "a courtyard", aspect_ratio: "4:5", image_size: "1K" });
      expect(body.input.image_input).toEqual([`data:image/png;base64,${Buffer.from("ref").toString("base64")}`]);
    },
  },
  {
    name: "gateway, hosted model",
    adapter: gatewayAdapter,
    model: "cf/flux-2-klein-4b",
    env: { IMAGE_GEN_ACCOUNT_ID: "acct", IMAGE_GEN_API_TOKEN: "tok" },
    success: () => json({ result: { image: b64 }, success: true }),
    viaLink: false,
    refusedInBody: () => json({ success: false, errors: [{ message: "NSFW content detected" }] }),
    assertRequest: (url, init) => {
      expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acct/ai/run/@cf/black-forest-labs/flux-2-klein-4b");
      const form = init.body as FormData;
      expect(form.get("prompt")).toBe("a courtyard");
      expect(form.get("width")).toBe("816");
      expect(form.get("height")).toBe("1024");
      expect(form.get("input_image_0")).toBeInstanceOf(Blob);
    },
  },
  {
    name: "Gemini direct",
    adapter: geminiAdapter,
    model: "gemini/nano-banana-pro",
    env: { IMAGE_GEN_GEMINI_API_KEY: "gk" },
    success: () => json({ output_image: { data: b64 } }),
    viaLink: false,
    refusedInBody: () => json({ status: "blocked", reason: "SAFETY" }),
    assertRequest: (url, init) => {
      expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
      expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("gk");
      const body = JSON.parse(String(init.body)) as { model: string; input: unknown[]; response_format: unknown };
      expect(body.model).toBe("gemini-3-pro-image");
      expect(body.input).toEqual([
        { type: "text", text: "a courtyard" },
        { type: "image", mime_type: "image/png", data: Buffer.from("ref").toString("base64") },
      ]);
      expect(body.response_format).toEqual({ type: "image", aspect_ratio: "4:5", image_size: "1K" });
    },
  },
  {
    name: "fal",
    adapter: falAdapter,
    model: "fal/bria-product-shot",
    env: { IMAGE_MODEL_API_KEY: "fk" },
    success: () => json({ images: [{ url: linked.url }] }),
    viaLink: true,
    refusedInBody: () => json({ detail: "Content policy violation" }, 422),
    assertRequest: (url, init) => {
      expect(url).toBe("https://fal.run/fal-ai/bria/product-shot");
      expect((init.headers as Record<string, string>).authorization).toBe("Key fk");
      expect(JSON.parse(String(init.body))).toMatchObject({ scene_description: "a courtyard", aspect_ratio: "4:5" });
    },
  },
];

const ENV_KEYS = ["IMAGE_GEN_ACCOUNT_ID", "IMAGE_GEN_API_TOKEN", "IMAGE_GEN_GEMINI_API_KEY", "IMAGE_MODEL_API_KEY", "IMAGE_MODEL_ENDPOINT"];
const fetchMock = vi.fn();
const input: AdapterCall = {
  prompt: "a courtyard",
  references: [{ bytes: Buffer.from("ref"), mimeType: "image/png", assetId: null }],
  aspect: "4:5",
  size: "1K",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  for (const key of ENV_KEYS) delete process.env[key];
});
afterEach(() => vi.unstubAllGlobals());

describe.each(CASES)("$name", (c) => {
  const model = modelById(c.model) as ModelEntry;
  const configure = () => Object.assign(process.env, c.env);
  const failsWith = async (kind: string) => {
    const call = c.adapter.call(model, input);
    await expect(call).rejects.toBeInstanceOf(GenerationFailure);
    await expect(call).rejects.toMatchObject({ kind });
  };

  it("is not configured without its credentials, and refuses as unavailable", async () => {
    expect(c.adapter.isConfigured()).toBe(false);
    await failsWith(GENERATION_FAILURE.UNAVAILABLE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the provider's own shape and returns the picture's bytes", async () => {
    configure();
    expect(c.adapter.isConfigured()).toBe(true);
    fetchMock.mockResolvedValueOnce(c.success());
    if (c.viaLink) fetchMock.mockResolvedValueOnce(new Response(PICTURE));
    await expect(c.adapter.call(model, input)).resolves.toEqual(PICTURE);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    c.assertRequest(url, init);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    if (c.viaLink) expect(fetchMock.mock.calls[1]?.[0]).toBe(linked.url);
  });

  it.each([
    ["a timeout", () => Promise.reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })), GENERATION_FAILURE.UNAVAILABLE],
    ["a 503", () => Promise.resolve(new Response("down", { status: 503 })), GENERATION_FAILURE.UNAVAILABLE],
    ["a 429", () => Promise.resolve(new Response("slow down", { status: 429 })), GENERATION_FAILURE.UNAVAILABLE],
    ["a 402", () => Promise.resolve(new Response("", { status: 402 })), GENERATION_FAILURE.NO_CREDIT],
    ["an empty account in words", () => Promise.resolve(new Response("insufficient balance on account", { status: 400 })), GENERATION_FAILURE.NO_CREDIT],
    ["garbage", () => Promise.resolve(new Response("<html>oops</html>", { status: 200 })), GENERATION_FAILURE.BAD_OUTPUT],
  ])("classifies %s", async (_, reply, kind) => {
    configure();
    fetchMock.mockImplementationOnce(reply);
    await failsWith(kind);
  });

  it("classifies the provider's own refusal as refused", async () => {
    configure();
    fetchMock.mockResolvedValueOnce(c.refusedInBody());
    await expect(c.adapter.call(model, input)).rejects.toMatchObject({ kind: GENERATION_FAILURE.REFUSED });
  });
});
