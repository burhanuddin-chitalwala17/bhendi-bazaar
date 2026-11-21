/**
 * A retried run never pays twice for a picture it has (generation-foundation spec R7, A5; trd D6),
 * and every call leaves a ledger row with its model, cost and rate (R6). The repository, the store,
 * the router and the rate are fakes; the generator's own decisions are what is under test.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { GENERATION_FAILURE, GenerationFailure, type GenerationRequest } from "@server/content/generation/generation.types";

const repo = {
  open: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  markRetriedAfterUnknown: vi.fn(),
};
const media = { putLooseObject: vi.fn(), readLooseObject: vi.fn() };
const routeCall = vi.fn();
const eligibleModels = vi.fn();
const rateFor = vi.fn();

vi.mock("@server/content/generation.repository", () => ({ generationRepository: repo }));
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: media }));
vi.mock("@server/content/generation/exchange-rate", () => ({ rateFor: () => rateFor() }));
vi.mock("@server/content/generation/router", () => ({
  eligibleModels: (...a: unknown[]) => eligibleModels(...a),
  routeCall: (...a: unknown[]) => routeCall(...a),
}));

const { generate, quote } = await import("@server/content/generation/generator");
const { modelById } = await import("@server/content/generation/registry");

const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#c0ffee" } }).png().toBuffer();
const klein = modelById("cf/flux-2-klein-4b");
const request: GenerationRequest = {
  purpose: "scene",
  prompt: "a table",
  promptVersion: "scene.v1",
  brief: null,
  references: [{ bytes: png, mimeType: "image/png", assetId: null }],
  aspect: "1:1",
  size: "1K",
  idempotencyKey: "enhancement:e1:scene",
  containsPerson: false,
  enhancementId: "e1",
};
const row = (over: Record<string, unknown> = {}) => ({
  id: "g1",
  idempotencyKey: "enhancement:e1:scene",
  modelId: null,
  state: "SUBMITTED",
  outputKeys: [],
  costMicroUsd: 0,
  costPaise: 0,
  error: null,
  ...over,
});

beforeEach(() => {
  for (const fn of [...Object.values(repo), ...Object.values(media), routeCall, eligibleModels, rateFor]) fn.mockReset();
  repo.open.mockResolvedValue({ row: row(), created: true });
  eligibleModels.mockReturnValue([klein]);
  routeCall.mockResolvedValue({ model: klein, image: png });
  rateFor.mockResolvedValue({ day: new Date("2026-11-21"), paisePerUsd: 9_340 });
});

describe("a first call", () => {
  it("opens the row before calling, stores the picture, then records model, cost and rate", async () => {
    const result = await generate(request);
    expect(repo.open.mock.invocationCallOrder[0]).toBeLessThan(routeCall.mock.invocationCallOrder[0] ?? 0);
    expect(media.putLooseObject).toHaveBeenCalledWith("generations/g1/0.png", expect.any(Buffer), "image/png");
    expect(repo.succeed).toHaveBeenCalledWith("g1", {
      modelId: "cf/flux-2-klein-4b",
      outputKeys: ["generations/g1/0.png"],
      costMicroUsd: 1_384,
      costPaise: 13,
      rateDay: new Date("2026-11-21"),
    });
    expect(result).toMatchObject({ generationId: "g1", modelId: "cf/flux-2-klein-4b", costPaise: 13 });
  });

  it("records a refusal as refused and passes it on", async () => {
    routeCall.mockRejectedValue(new GenerationFailure(GENERATION_FAILURE.REFUSED, "safety"));
    await expect(generate(request)).rejects.toMatchObject({ kind: GENERATION_FAILURE.REFUSED });
    expect(repo.fail).toHaveBeenCalledWith("g1", true, expect.stringContaining("REFUSED"), null);
  });

  it("refuses a priced model before calling it when no rate was ever stored (Q13)", async () => {
    rateFor.mockResolvedValue(null);
    await expect(generate(request)).rejects.toMatchObject({ kind: GENERATION_FAILURE.UNAVAILABLE });
    expect(routeCall).not.toHaveBeenCalled();
  });
});

describe("a retry with the same key", () => {
  it("replays a finished picture from the store and calls no model (A5)", async () => {
    repo.open.mockResolvedValue({
      row: row({ state: "SUCCEEDED", modelId: "cf/flux-2-klein-4b", outputKeys: ["generations/g1/0.png"], costPaise: 13, costMicroUsd: 1_384 }),
      created: false,
    });
    media.readLooseObject.mockResolvedValue(png);
    await expect(generate(request)).resolves.toMatchObject({ images: [png], costPaise: 13 });
    expect(routeCall).not.toHaveBeenCalled();
  });

  it("repeats a refusal without asking again", async () => {
    repo.open.mockResolvedValue({ row: row({ state: "REFUSED", error: "safety" }), created: false });
    await expect(generate(request)).rejects.toMatchObject({ kind: GENERATION_FAILURE.REFUSED });
    expect(routeCall).not.toHaveBeenCalled();
  });

  it("calls again after a worker died mid-call, and says so on the row", async () => {
    repo.open.mockResolvedValue({ row: row(), created: false });
    await generate(request);
    expect(repo.markRetriedAfterUnknown).toHaveBeenCalledWith("g1");
    expect(routeCall).toHaveBeenCalledTimes(1);
  });
});

describe("a quote", () => {
  it("is the first eligible model's price at today's rate", async () => {
    await expect(quote("scene", { references: 1, aspect: "1:1", size: "1K" })).resolves.toEqual({
      modelId: "cf/flux-2-klein-4b",
      maxReferences: 1,
      costMicroUsd: 1_384,
      costPaise: 13,
    });
  });

  it("is null when nothing is set up to take the request", async () => {
    eligibleModels.mockReturnValue([]);
    await expect(quote("scene", { references: 1, aspect: "1:1", size: "1K" })).resolves.toBeNull();
  });
});
