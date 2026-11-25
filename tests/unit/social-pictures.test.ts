/**
 * Post pictures on the server (ai-images/social-posts unit 1; D1, R1–R4): the `social` purpose with
 * its own prompt version and model order, carried from the request to the run, and the presets a post
 * gives Describe it — shape from its destinations, its products' main photos as references. Every
 * collaborator is a fake; the catalog read is proved against a real schema in
 * tests/integration/social-picture-presets.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@server/shared/domain-error";

const repo = {
  create: vi.fn(),
  findById: vi.fn(),
  findForOrg: vi.fn(),
  markRunning: vi.fn(),
  markProposed: vi.fn(),
  markFailed: vi.fn(),
  findStale: vi.fn(),
  countRecent: vi.fn(),
};
const media = {
  findReadyImage: vi.fn(),
  readImageForModel: vi.fn(),
  deleteLooseObject: vi.fn(),
  putLooseObject: vi.fn(),
  tagAsReference: vi.fn(),
  publicUrlOf: (key: string) => `https://img.test/${key}`,
};
const credit = { charge: vi.fn(), settle: vi.fn(), refund: vi.fn(), marginFor: vi.fn(), priceFor: vi.fn(), account: vi.fn() };
const enhancement = { assertMayRun: vi.fn(), accept: vi.fn() };
const generate = vi.fn();
const quoteRange = vi.fn();
const generations = { costForEnhancement: vi.fn(), outputKeysForEnhancement: vi.fn() };
const posts = { get: vi.fn() };
const products = { mainPhotos: vi.fn() };
const tx = { marker: "tx" };

vi.mock("@server/content/enhancement.repository", () => ({ enhancementRepository: repo }));
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));
vi.mock("@server/catalog/product.service", () => ({ productService: products }));
vi.mock("@server/social/post.service", () => ({ postService: posts }));
vi.mock("@server/payouts/credit.service", () => ({ creditService: credit }));
vi.mock("@server/content/enhancement.service", () => ({ enhancementService: enhancement }));
vi.mock("@server/content/generation/generator", () => ({ generate: (...a: unknown[]) => generate(...a), quoteRange: (...a: unknown[]) => quoteRange(...a) }));
vi.mock("@server/content/generation.repository", () => ({ generationRepository: generations }));
vi.mock("@server/shared/jobs", () => ({ enqueue: vi.fn() }));
vi.mock("@server/shared/prisma", () => ({ prisma: { $transaction: async (work: (t: unknown) => unknown) => work(tx) } }));

const { styledService } = await import("@server/content/styled.service");
const { socialPictureService, socialAspectFor } = await import("@server/content/social-picture.service");
const { socialPrompt, listingPrompt } = await import("@server/content/generation/prompts");
const { DEFAULT_MODELS, modelById } = await import("@server/content/generation/registry");
const { environmentModelOrder } = await import("@server/content/generation/model-order");
const { requestStyledSchema, styledQuoteQuerySchema } = await import("@/lib/validation/schemas/enhancement.schema");
const sharp = (await import("sharp")).default;

const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ffffff" } }).png().toBuffer();
const abaya = { id: "a1", ref: "https://img.test/abaya.webp" };
const bag = { id: "a2", ref: "https://img.test/bag.webp" };
const ask = {
  sourceAssetId: "a1",
  brief: "Worn by a model on a Mumbai street, festive",
  referenceRefs: [bag.ref],
  face: "no-face" as const,
  aspect: "4:5" as const,
  purpose: "social" as const,
};
const row = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  orgId: "org-1",
  tool: "STYLED",
  state: "REQUESTED",
  preset: "no-face",
  purpose: "social",
  sourceAssetId: "a1",
  brief: ask.brief,
  referenceRefs: [bag.ref],
  aspect: "4:5",
  sourceAsset: { ref: abaya.ref },
  resultAsset: null,
  createdAt: new Date("2026-11-25T10:00:00Z"),
  proposedAt: null,
  decidedAt: null,
  ...over,
});

beforeEach(() => {
  for (const fn of [...Object.values(repo), ...Object.values(credit), ...Object.values(enhancement), generate, quoteRange, posts.get, products.mainPhotos]) fn.mockReset();
  media.findReadyImage.mockReset().mockImplementation(async (_org: string, s: { assetId?: string; ref?: string }) =>
    s.assetId === "a1" || s.ref === abaya.ref ? abaya : s.ref === bag.ref ? bag : null,
  );
  media.readImageForModel.mockReset().mockResolvedValue({ bytes: png, mimeType: "image/webp" });
  media.deleteLooseObject.mockReset().mockResolvedValue(undefined);
  media.putLooseObject.mockReset();
  media.tagAsReference.mockReset().mockResolvedValue(undefined);
  generations.costForEnhancement.mockReset().mockResolvedValue(1_273);
  generations.outputKeysForEnhancement.mockReset().mockResolvedValue([]);
  enhancement.assertMayRun.mockResolvedValue({ used: 3, allowance: 300, paused: false, pauseReason: null });
  quoteRange.mockResolvedValue({ first: { modelId: "cf/nano-banana-pro", maxReferences: 3, costMicroUsd: 136_200, costPaise: 1_273 }, worstCostPaise: 1_273 });
  credit.marginFor.mockResolvedValue(0);
  repo.create.mockResolvedValue(row());
  repo.markRunning.mockResolvedValue(true);
  repo.findStale.mockResolvedValue([]);
  repo.countRecent.mockResolvedValue(0);
});

describe("a post picture is a purpose of its own (D1, R2)", () => {
  it("has its own model order, every id a registry entry, changeable by IMAGE_GEN_MODELS_SOCIAL (spec A1)", async () => {
    expect(DEFAULT_MODELS.social.length).toBeGreaterThan(0);
    for (const id of DEFAULT_MODELS.social) expect(modelById(id), id).toBeDefined();
    process.env.IMAGE_GEN_MODELS_SOCIAL = "gemini/nano-banana-2";
    try {
      expect(await environmentModelOrder.orderFor("social")).toEqual(["gemini/nano-banana-2"]);
    } finally {
      delete process.env.IMAGE_GEN_MODELS_SOCIAL;
    }
  });

  it("has its own prompt version: the product kept exact, the face rule, the shop's words in their section", () => {
    const prompt = socialPrompt("no-face", ask.brief);
    expect(prompt.version).toBe("social.v1");
    expect(prompt.version).not.toBe(listingPrompt("no-face", ask.brief).version);
    expect(prompt.text).toMatch(/social media post/);
    expect(prompt.text).toMatch(/keep each\s+exactly as it is/);
    expect(prompt.text).toMatch(/below the chin/);
    expect(prompt.text).toMatch(/no added text/);
    expect(prompt.text).toMatch(/<shop_brief>Worn by a model on a Mumbai street, festive<\/shop_brief>/);
    expect(socialPrompt("with-face", "x").text).toMatch(/natural, realistic person/);
  });
});

describe("asking for a post picture through Improve with AI's path (D1, R1, R3)", () => {
  it("records the purpose on the run and quotes and holds credit by the social model order (spec A1)", async () => {
    await styledService.request("org-1", "u1", ask);
    expect(quoteRange).toHaveBeenCalledWith("social", { references: 2, aspect: "4:5", size: "1K" });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ tool: "STYLED", purpose: "social", aspect: "4:5" }), tx);
    expect(credit.charge).toHaveBeenCalledWith(tx, { orgId: "org-1", enhancementId: "e1", costPaise: 1_273, worstCostPaise: 1_273, marginBps: 0 });
  });

  it("is a listing picture when no purpose is named, as every request before this one was", async () => {
    const { purpose: _purpose, ...listing } = ask;
    await styledService.request("org-1", "u1", listing);
    expect(quoteRange).toHaveBeenCalledWith("listing", expect.anything());
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ purpose: "listing" }), tx);
  });

  it("quotes the cost line by the purpose the window was opened for (spec A1)", async () => {
    credit.priceFor.mockResolvedValue({ chargePaise: 1_273, marginBps: 0 });
    credit.account.mockResolvedValue({ balancePaise: 250_000 });
    await styledService.quote("org-1", 2, "4:5", "social");
    expect(quoteRange).toHaveBeenCalledWith("social", { references: 3, aspect: "4:5", size: "1K" });
  });

  it("runs a social row on the social purpose and prompt, keeps the picture and settles to its cost (spec A1)", async () => {
    repo.findById.mockResolvedValue(row());
    generate.mockResolvedValue({ generationId: "g1", images: [png], modelId: "cf/nano-banana-pro", costMicroUsd: 136_200, costPaise: 1_273 });
    await expect(styledService.run("e1")).resolves.toBe(true);
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ purpose: "social", promptVersion: "social.v1", aspect: "4:5", brief: ask.brief });
    expect(enhancement.accept).toHaveBeenCalledWith("org-1", "e1", expect.any(Date));
    expect(credit.settle).toHaveBeenCalledWith("e1", 1_273);
  });

  it("runs a row stored before purposes were recorded as a listing picture", async () => {
    repo.findById.mockResolvedValue(row({ purpose: null }));
    generate.mockResolvedValue({ generationId: "g1", images: [png], modelId: "m", costMicroUsd: 1, costPaise: 1 });
    await styledService.run("e1");
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ purpose: "listing", promptVersion: "listing.v1" });
  });

  it("regenerates a post picture as a new run that records the one it came from; both are kept (spec A2)", async () => {
    repo.findForOrg.mockResolvedValue(row({ state: "ACCEPTED" }));
    await styledService.request("org-1", "u1", { ...ask, brief: "Brighter, at dusk", previousId: "e1" });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ purpose: "social", previousId: "e1", brief: "Brighter, at dusk" }), tx);
  });

  it("refuses to regenerate a post picture as a listing one, before anything is held (review)", async () => {
    repo.findForOrg.mockResolvedValue(row({ state: "ACCEPTED" }));
    await expect(styledService.request("org-1", "u1", { ...ask, purpose: "listing", previousId: "e1" })).rejects.toBeInstanceOf(NotFoundError);
    expect(credit.charge).not.toHaveBeenCalled();
  });

  it("accepts social and listing on the wire, listing by default, and nothing else", () => {
    const body = { sourceAssetId: "cmt32hxzc000304l3fj9lhaew", brief: "On a café table", face: "no-face", aspect: "4:5" };
    expect(requestStyledSchema.parse(body).purpose).toBe("listing");
    expect(requestStyledSchema.parse({ ...body, purpose: "social" }).purpose).toBe("social");
    expect(requestStyledSchema.safeParse({ ...body, purpose: "scene" }).success).toBe(false);
    expect(styledQuoteQuerySchema.parse({ references: "1", purpose: "social" }).purpose).toBe("social");
    expect(styledQuoteQuerySchema.parse({ references: "1", purpose: "scene" }).purpose).toBe("listing");
  });
});

describe("the presets a post gives Describe it (D1, R1)", () => {
  const post = (over: Record<string, unknown> = {}) => ({ id: "p1", productIds: ["pr1", "pr2"], destinations: ["IG_FEED"], ...over });

  it("is Portrait for an Instagram post, Tall when only a story or Status is picked (spec A1)", () => {
    expect(socialAspectFor(["IG_FEED"])).toBe("4:5");
    expect(socialAspectFor(["IG_STORY", "IG_FEED", "WA_STATUS"])).toBe("4:5");
    expect(socialAspectFor(["IG_STORY"])).toBe("9:16");
    expect(socialAspectFor(["WA_STATUS", "IG_STORY"])).toBe("9:16");
    expect(socialAspectFor([])).toBeNull();
  });

  it("offers the post's products' main photos, the first product first (spec A1)", async () => {
    posts.get.mockResolvedValue(post());
    products.mainPhotos.mockResolvedValue(new Map([["pr2", bag], ["pr1", abaya]]));
    await expect(socialPictureService.presets("org-1", "p1")).resolves.toEqual({ aspect: "4:5", referenceRefs: [abaya.ref, bag.ref] });
    expect(products.mainPhotos).toHaveBeenCalledWith("org-1", ["pr1", "pr2"]);
  });

  it("offers the first three photos of more than three products, skipping one with no photo and a repeat", async () => {
    posts.get.mockResolvedValue(post({ productIds: ["pr1", "none", "pr2", "same", "pr3", "pr4"] }));
    products.mainPhotos.mockResolvedValue(
      new Map([
        ["pr1", { id: "a1", ref: "https://img.test/1.webp" }],
        ["pr2", { id: "a2", ref: "https://img.test/2.webp" }],
        ["same", { id: "a2", ref: "https://img.test/2.webp" }],
        ["pr3", { id: "a3", ref: "https://img.test/3.webp" }],
        ["pr4", { id: "a4", ref: "https://img.test/4.webp" }],
      ]),
    );
    const { referenceRefs } = await socialPictureService.presets("org-1", "p1");
    expect(referenceRefs).toEqual(["https://img.test/1.webp", "https://img.test/2.webp", "https://img.test/3.webp"]);
  });

  it("is empty for a post naming no product, and asks catalog nothing", async () => {
    posts.get.mockResolvedValue(post({ productIds: [], destinations: [] }));
    await expect(socialPictureService.presets("org-1", "p1")).resolves.toEqual({ aspect: null, referenceRefs: [] });
    expect(products.mainPhotos).not.toHaveBeenCalled();
  });

  it("is not found for another shop's post, as the composer is", async () => {
    posts.get.mockRejectedValue(new NotFoundError("Post not found"));
    await expect(socialPictureService.presets("org-2", "p1")).rejects.toBeInstanceOf(NotFoundError);
  });
});
