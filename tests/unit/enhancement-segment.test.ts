/**
 * The cut-out capability behind its seam (image-enhancement spec R8, trd D3): the preference
 * decides, the other service is the fallback, neither being set up is a refusal the org member can
 * read, and no message anywhere names a vendor. Each service's request is asserted by its URL,
 * headers and body with `fetch` stubbed — nothing here goes near a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import { SEGMENT_TIMEOUT_MS, type StoreUrls } from "@server/content/providers/segment";
import { zoneCutOutUrl, zoneSegmenter } from "@server/content/providers/segment/zone";
import { modelEndpoint, modelSegmenter } from "@server/content/providers/segment/model";

const media = { publicBaseUrl: vi.fn(), publicUrlOf: vi.fn() };
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));

const { segmenterFor, availableSegmenters, DEFAULT_SEGMENT_PROVIDER } = await import("@server/content/providers");

/** A custom images domain, as production has; the `r2.dev` one below is what development has. */
const CUSTOM: StoreUrls = {
  base: "https://images.bhendi-bazaar.com",
  urlOf: (key) => `https://images.bhendi-bazaar.com/${key.split("/").map(encodeURIComponent).join("/")}`,
};
const BUCKET: StoreUrls = {
  base: "https://pub-abc.r2.dev",
  urlOf: (key) => `https://pub-abc.r2.dev/${key}`,
};

const photo = { bytes: Buffer.from("source"), objectKey: "products/org-1/a b.webp", mimeType: "image/webp" };
const png = Buffer.from("cut-out png bytes");

const ok = (body: BodyInit) => new Response(body, { status: 200 });
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  media.publicBaseUrl.mockReturnValue(CUSTOM.base);
  media.publicUrlOf.mockImplementation(CUSTOM.urlOf);
  delete process.env.IMAGE_MODEL_API_KEY;
  delete process.env.IMAGE_MODEL_ENDPOINT;
  delete process.env.IMAGE_SEGMENT_PROVIDER;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the image host's own transform", () => {
  it("asks for the foreground as PNG, in front of the path the store spells", async () => {
    expect(zoneCutOutUrl(CUSTOM, photo.objectKey)).toBe(
      "https://images.bhendi-bazaar.com/cdn-cgi/image/segment=foreground,format=png/products/org-1/a%20b.webp",
    );
  });

  it("fetches that URL under a timeout and hands back the bytes", async () => {
    fetchMock.mockResolvedValue(ok(png));
    await expect(zoneSegmenter(CUSTOM).cutOut(photo)).resolves.toEqual(png);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/cdn-cgi/image/segment=foreground,format=png/");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(SEGMENT_TIMEOUT_MS).toBe(30_000);
  });

  it("is unavailable on the development bucket, which serves objects and transforms nothing", () => {
    expect(zoneSegmenter(BUCKET).isAvailable()).toBe(false);
    expect(zoneSegmenter(CUSTOM).isAvailable()).toBe(true);
    expect(zoneSegmenter({ ...CUSTOM, base: "not a url" }).isAvailable()).toBe(false);
  });

  it("turns a refusal into a shown message that names no vendor, and fetches nothing without a key", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(zoneSegmenter(CUSTOM).cutOut(photo)).rejects.toBeInstanceOf(DomainError);
    await expect(zoneSegmenter(CUSTOM).cutOut(photo)).rejects.toThrow(/background could not be removed/i);

    fetchMock.mockReset();
    await expect(zoneSegmenter(CUSTOM).cutOut({ ...photo, objectKey: null })).rejects.toBeInstanceOf(DomainError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the hosted model", () => {
  beforeEach(() => {
    process.env.IMAGE_MODEL_API_KEY = "k-123";
  });

  it("is available exactly while a key is set, and sends the picture's own URL to the default endpoint", async () => {
    expect(modelSegmenter(CUSTOM).isAvailable()).toBe(true);
    fetchMock.mockResolvedValueOnce(ok(JSON.stringify({ image: { url: "https://cdn.test/cut.png" } }))).mockResolvedValueOnce(ok(png));

    await expect(modelSegmenter(CUSTOM).cutOut(photo)).resolves.toEqual(png);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fal.run/fal-ai/birefnet");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Key k-123");
    expect(JSON.parse(init.body)).toEqual({
      image_url: "https://images.bhendi-bazaar.com/products/org-1/a%20b.webp",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // The answer is a link; the bytes are a second, equally bounded fetch.
    expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.test/cut.png");
  });

  it("goes where the environment points it, with no trailing slash left doubled", async () => {
    process.env.IMAGE_MODEL_ENDPOINT = "https://models.internal/v1/";
    expect(modelEndpoint()).toBe("https://models.internal/v1");
    fetchMock.mockResolvedValueOnce(ok(JSON.stringify({ image: { url: "https://cdn.test/cut.png" } }))).mockResolvedValueOnce(ok(png));
    await modelSegmenter(CUSTOM).cutOut(photo);
    expect(fetchMock.mock.calls[0][0]).toBe("https://models.internal/v1/fal-ai/birefnet");
  });

  it("turns a 500, a shape it does not recognise and a dead socket into the same shown message", async () => {
    fetchMock.mockResolvedValue(new Response("upstream exploded", { status: 500 }));
    await expect(modelSegmenter(CUSTOM).cutOut(photo)).rejects.toBeInstanceOf(DomainError);

    fetchMock.mockReset().mockResolvedValue(ok(JSON.stringify({ detail: "quota" })));
    await expect(modelSegmenter(CUSTOM).cutOut(photo)).rejects.toThrow(/background could not be removed/i);

    fetchMock.mockReset().mockRejectedValue(new Error("ECONNRESET"));
    await expect(modelSegmenter(CUSTOM).cutOut(photo)).rejects.toThrow(/background could not be removed/i);
  });

  it("is unavailable without a key, and asks nothing of the network", async () => {
    delete process.env.IMAGE_MODEL_API_KEY;
    expect(modelSegmenter(CUSTOM).isAvailable()).toBe(false);
    await expect(modelSegmenter(CUSTOM).cutOut(photo)).rejects.toBeInstanceOf(DomainError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("which service is chosen", () => {
  it("defaults to the image host we already pay for", () => {
    expect(DEFAULT_SEGMENT_PROVIDER).toBe(ENHANCEMENT_PROVIDER.ZONE);
    expect(segmenterFor().key).toBe(ENHANCEMENT_PROVIDER.ZONE);
  });

  it("honours the preference where that service is set up", () => {
    process.env.IMAGE_MODEL_API_KEY = "k-123";
    expect(segmenterFor(ENHANCEMENT_PROVIDER.MODEL).key).toBe(ENHANCEMENT_PROVIDER.MODEL);
    expect(segmenterFor(ENHANCEMENT_PROVIDER.ZONE).key).toBe(ENHANCEMENT_PROVIDER.ZONE);
  });

  it("reads the preference from the environment, and treats a value it does not know as the default", () => {
    process.env.IMAGE_MODEL_API_KEY = "k-123";
    process.env.IMAGE_SEGMENT_PROVIDER = "model";
    expect(segmenterFor().key).toBe(ENHANCEMENT_PROVIDER.MODEL);
    process.env.IMAGE_SEGMENT_PROVIDER = "photoroom";
    expect(segmenterFor().key).toBe(DEFAULT_SEGMENT_PROVIDER);
  });

  it("falls to the other where the preferred one is not set up", () => {
    // Development: the bucket URL has no transforms, so the model takes over where there is a key.
    media.publicBaseUrl.mockReturnValue(BUCKET.base);
    media.publicUrlOf.mockImplementation(BUCKET.urlOf);
    process.env.IMAGE_MODEL_API_KEY = "k-123";
    expect(segmenterFor(ENHANCEMENT_PROVIDER.ZONE).key).toBe(ENHANCEMENT_PROVIDER.MODEL);

    // And the other way: the model is preferred but has no key, so the image host runs it.
    delete process.env.IMAGE_MODEL_API_KEY;
    media.publicBaseUrl.mockReturnValue(CUSTOM.base);
    expect(segmenterFor(ENHANCEMENT_PROVIDER.MODEL).key).toBe(ENHANCEMENT_PROVIDER.ZONE);
  });

  it("refuses in the org member's words when neither is set up, naming no vendor", () => {
    media.publicBaseUrl.mockReturnValue(BUCKET.base);
    media.publicUrlOf.mockImplementation(BUCKET.urlOf);
    expect(() => segmenterFor()).toThrow(DomainError);
    expect(() => segmenterFor()).toThrow("Background removal is not set up yet");
  });

  it("offers the bake-off every service that could run, and nothing that could not", () => {
    expect(availableSegmenters().map((s) => s.key)).toEqual([ENHANCEMENT_PROVIDER.ZONE]);
    process.env.IMAGE_MODEL_API_KEY = "k-123";
    expect(availableSegmenters().map((s) => s.key)).toEqual([ENHANCEMENT_PROVIDER.ZONE, ENHANCEMENT_PROVIDER.MODEL]);
    media.publicBaseUrl.mockReturnValue(BUCKET.base);
    expect(availableSegmenters().map((s) => s.key)).toEqual([ENHANCEMENT_PROVIDER.MODEL]);
  });
});

describe("no message anywhere names the service that produced it", () => {
  it("keeps the vendor out of everything an org member could read", async () => {
    const vendors = [/fal/i, /cloudflare/i, /birefnet/i, /r2\b/i, /photoroom/i];
    const messages: string[] = [];

    fetchMock.mockResolvedValue(new Response("fal.ai says: birefnet is overloaded", { status: 503 }));
    await zoneSegmenter(CUSTOM).cutOut(photo).catch((error: DomainError) => messages.push(error.message));
    process.env.IMAGE_MODEL_API_KEY = "k-123";
    await modelSegmenter(CUSTOM).cutOut(photo).catch((error: DomainError) => messages.push(error.message));
    media.publicBaseUrl.mockReturnValue(BUCKET.base);
    media.publicUrlOf.mockImplementation(BUCKET.urlOf);
    delete process.env.IMAGE_MODEL_API_KEY;
    try {
      segmenterFor();
    } catch (error) {
      messages.push((error as DomainError).message);
    }

    expect(messages).toHaveLength(3);
    for (const message of messages) {
      for (const vendor of vendors) expect(message, `"${message}" names a vendor`).not.toMatch(vendor);
    }
  });
});
