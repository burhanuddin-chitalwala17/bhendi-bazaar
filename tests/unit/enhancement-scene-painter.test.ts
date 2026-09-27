/**
 * The scene capability behind its seam (image-enhancement spec R8, R11; trd D3): one painter, its
 * request asserted by URL, header and body, and every way it can refuse turned into a sentence an
 * org member can act on — including the one a shop cannot act on at all, an account with no credit
 * left, which is the platform owner's to fix and says so. `fetch` is stubbed throughout: nothing
 * here goes near a network, and nothing here needs a balance to prove.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import { SCENE_PRESET, type ScenePreset } from "@server/content/scene-presets";
import {
  SCENE_FAILED_MESSAGE,
  SCENE_NO_CREDIT_MESSAGE,
  SCENE_TIMEOUT_MS,
} from "@server/content/providers/scene";
import { modelScenePainter } from "@server/content/providers/scene/model";

const media = { publicBaseUrl: vi.fn(() => "https://images.bhendi-bazaar.com"), publicUrlOf: vi.fn() };
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));

const { scenePainterFor } = await import("@server/content/providers");

const cutout = Buffer.from("the product on nothing");
const painted = Buffer.from("the painted scene");
const table = SCENE_PRESET["wooden-table"];
const drape = SCENE_PRESET["fabric-drape"];

const ask = (preset: ScenePreset = table) => ({ cutout, prompt: preset.prompt, aspect: preset.aspect });
const ok = (body: BodyInit) => new Response(body, { status: 200 });
const link = () => ok(JSON.stringify({ images: [{ url: "https://cdn.test/scene.png" }] }));
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  delete process.env.IMAGE_MODEL_API_KEY;
  delete process.env.IMAGE_MODEL_ENDPOINT;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the painter's request", () => {
  beforeEach(() => {
    process.env.IMAGE_MODEL_API_KEY = "k-123";
  });

  it("posts the cut-out, the preset's own words and its shape, under a bounded timeout", async () => {
    fetchMock.mockResolvedValueOnce(link()).mockResolvedValueOnce(ok(painted));

    await expect(modelScenePainter().paint(ask())).resolves.toEqual(painted);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fal.run/fal-ai/bria/product-shot");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Key k-123");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(SCENE_TIMEOUT_MS).toBe(60_000);

    const body = JSON.parse(init.body);
    // The cut-out is an intermediate nobody stored, so it travels in the request itself.
    expect(body.image_url).toBe(`data:image/png;base64,${cutout.toString("base64")}`);
    expect(body.scene_description).toBe(table.prompt);
    expect(body.aspect_ratio).toBe("1:1");

    // The answer is a link; the bytes are a second fetch, bounded the same way.
    expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.test/scene.png");
    expect(fetchMock.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("sends a tall preset's shape rather than the square one", async () => {
    fetchMock.mockResolvedValueOnce(link()).mockResolvedValueOnce(ok(painted));
    await modelScenePainter().paint(ask(drape));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).aspect_ratio).toBe("4:5");
  });

  it("goes where the environment points it, with no trailing slash left doubled", async () => {
    process.env.IMAGE_MODEL_ENDPOINT = "https://models.internal/v1/";
    fetchMock.mockResolvedValueOnce(link()).mockResolvedValueOnce(ok(painted));
    await modelScenePainter().paint(ask());
    expect(fetchMock.mock.calls[0][0]).toBe("https://models.internal/v1/fal-ai/bria/product-shot");
  });
});

describe("what the org member is told when it will not answer", () => {
  beforeEach(() => {
    process.env.IMAGE_MODEL_API_KEY = "k-123";
  });

  it("turns a 500 into one shown sentence rather than the service's words", async () => {
    fetchMock.mockResolvedValue(new Response("fal.ai: bria worker exploded", { status: 500 }));
    await expect(modelScenePainter().paint(ask())).rejects.toBeInstanceOf(DomainError);
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_FAILED_MESSAGE);
  });

  it("says a 402 is money, not weather — the one refusal waiting cannot fix", async () => {
    fetchMock.mockResolvedValue(new Response("Payment Required", { status: 402 }));
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_NO_CREDIT_MESSAGE);
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(/out of credit/i);
  });

  it("reads a quota refusal the same way, whatever status it arrives under", async () => {
    // The account this was built against had a key and no balance, which is exactly this case.
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ detail: "Exhausted balance" }), { status: 403 }));
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_NO_CREDIT_MESSAGE);

    fetchMock.mockReset().mockResolvedValue(new Response("user quota exceeded", { status: 429 }));
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_NO_CREDIT_MESSAGE);
  });

  it("does not read an ordinary failure as an empty wallet", async () => {
    fetchMock.mockResolvedValue(new Response("internal error", { status: 500 }));
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_FAILED_MESSAGE);
  });

  it("turns a timeout into a refusal rather than letting it escape to the queue", async () => {
    // What `AbortSignal.timeout` throws when the service stops answering mid-request.
    fetchMock.mockRejectedValue(Object.assign(new Error("signal timed out"), { name: "TimeoutError" }));
    await expect(modelScenePainter().paint(ask())).rejects.toBeInstanceOf(DomainError);
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_FAILED_MESSAGE);
  });

  it("treats an answer it does not recognise, and a dead link, as the same failure", async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify({ status: "IN_QUEUE" })));
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_FAILED_MESSAGE);

    fetchMock.mockReset().mockResolvedValueOnce(link()).mockResolvedValueOnce(new Response("gone", { status: 404 }));
    await expect(modelScenePainter().paint(ask())).rejects.toThrow(SCENE_FAILED_MESSAGE);
  });

  it("names no vendor in anything a member could read", async () => {
    const vendors = [/fal/i, /bria/i, /cloudflare/i, /r2\b/i];
    const messages = [SCENE_FAILED_MESSAGE, SCENE_NO_CREDIT_MESSAGE];

    fetchMock.mockResolvedValue(new Response("fal.ai says bria is out of balance", { status: 402 }));
    await modelScenePainter().paint(ask()).catch((error: DomainError) => messages.push(error.message));
    delete process.env.IMAGE_MODEL_API_KEY;
    try {
      scenePainterFor();
    } catch (error) {
      messages.push((error as DomainError).message);
    }

    expect(messages).toHaveLength(4);
    for (const message of messages) {
      for (const vendor of vendors) expect(message, `"${message}" names a vendor`).not.toMatch(vendor);
    }
  });
});

describe("which service paints", () => {
  it("is the hosted model while a key is set, and asks nothing of the network to decide", () => {
    process.env.IMAGE_MODEL_API_KEY = "k-123";
    expect(modelScenePainter().isAvailable()).toBe(true);
    expect(scenePainterFor().key).toBe(ENHANCEMENT_PROVIDER.MODEL);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses in the org member's words with no key, since a scene has no free route", async () => {
    expect(modelScenePainter().isAvailable()).toBe(false);
    expect(() => scenePainterFor()).toThrow(DomainError);
    expect(() => scenePainterFor()).toThrow("Scene backdrops are not set up yet");
    // And the painter itself refuses rather than posting to a service it cannot authenticate to.
    await expect(modelScenePainter().paint(ask())).rejects.toBeInstanceOf(DomainError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
