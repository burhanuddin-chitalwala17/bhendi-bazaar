/**
 * The scene painter over the generation port (generation-foundation spec R8, trd D8). Which model
 * paints is the router's business, so the port is mocked: what is held here is what the painter asks
 * for — the cut-out as the one reference, the preset's words inside the versioned scene prompt, its
 * shape, and the run's own idempotency key — and how each kind of failure reaches an org member.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@server/shared/domain-error";
import { ENHANCEMENT_PROVIDER } from "@server/content/enhancement.types";
import { SCENE_PRESET } from "@server/content/scene-presets";
import { SCENE_FAILED_MESSAGE, SCENE_NO_CREDIT_MESSAGE } from "@server/content/providers/scene";
import { GENERATION_FAILURE, GenerationFailure } from "@server/content/generation/generation.types";

const generate = vi.fn();
const eligibleModels = vi.fn();
vi.mock("@server/content/generation/generator", () => ({ generate: (...args: unknown[]) => generate(...args) }));
vi.mock("@server/content/generation/router", () => ({ eligibleModels: (...args: unknown[]) => eligibleModels(...args) }));
vi.mock("@server/catalog/media-asset.service", () => ({ mediaAssetService: { publicBaseUrl: () => "", publicUrlOf: vi.fn() } }));

const { generatedScenePainter, SCENE_REFUSED_MESSAGE } = await import("@server/content/providers/scene/generated");
const { scenePainterFor } = await import("@server/content/providers");

const cutout = Buffer.from("the product on nothing");
const painted = Buffer.from("the painted scene");
const table = SCENE_PRESET["wooden-table"];
const drape = SCENE_PRESET["fabric-drape"];

beforeEach(() => {
  generate.mockReset().mockResolvedValue({ generationId: "g1", images: [painted], modelId: "cf/flux-2-klein-4b", costMicroUsd: 1384, costPaise: 13 });
  eligibleModels.mockReset().mockReturnValue([{ id: "cf/flux-2-klein-4b" }]);
});

describe("what the painter asks for", () => {
  it("sends the cut-out as the one reference, the setting inside the scene prompt, and the run as the key", async () => {
    await expect(generatedScenePainter("e1").paint({ cutout, prompt: table.prompt, aspect: table.aspect })).resolves.toBe(painted);
    const [request] = generate.mock.calls[0] as [Record<string, unknown>];
    expect(request).toMatchObject({
      purpose: "scene",
      promptVersion: "scene.v1",
      brief: null,
      aspect: "1:1",
      size: "1K",
      idempotencyKey: "enhancement:e1:scene",
      enhancementId: "e1",
      containsPerson: false,
      references: [{ bytes: cutout, mimeType: "image/png", assetId: null }],
    });
    expect(request.prompt).toContain(table.prompt);
  });

  it("asks a tall setting in the tall shape", async () => {
    await generatedScenePainter("e2").paint({ cutout, prompt: drape.prompt, aspect: drape.aspect });
    expect(generate.mock.calls[0]?.[0]).toMatchObject({ aspect: "4:5" });
  });

  it("is recorded on the enhancement as the generation module, whose own row names the model", () => {
    expect(generatedScenePainter("e1").key).toBe(ENHANCEMENT_PROVIDER.GENERATION);
  });
});

describe("how a failure reaches the shop", () => {
  it.each([
    [GENERATION_FAILURE.NO_CREDIT, SCENE_NO_CREDIT_MESSAGE],
    [GENERATION_FAILURE.REFUSED, SCENE_REFUSED_MESSAGE],
    [GENERATION_FAILURE.UNAVAILABLE, SCENE_FAILED_MESSAGE],
    [GENERATION_FAILURE.BAD_OUTPUT, SCENE_FAILED_MESSAGE],
  ])("%s becomes one sentence in the shop's language", async (kind, message) => {
    generate.mockRejectedValue(new GenerationFailure(kind, "vendor words"));
    const paint = generatedScenePainter("e1").paint({ cutout, prompt: table.prompt, aspect: table.aspect });
    await expect(paint).rejects.toBeInstanceOf(DomainError);
    await expect(paint).rejects.toThrow(message);
  });

  it("lets anything else through for the queue to retry", async () => {
    generate.mockRejectedValue(new Error("database went away"));
    await expect(generatedScenePainter("e1").paint({ cutout, prompt: table.prompt, aspect: table.aspect })).rejects.not.toBeInstanceOf(DomainError);
  });
});

describe("whether a scene can be painted at all", () => {
  it("is refused before a slot is spent when no model is set up", async () => {
    eligibleModels.mockReturnValue([]);
    await expect(scenePainterFor()).rejects.toThrow("Scene backdrops are not set up yet");
  });

  it("is a painter bound to the run when one is", async () => {
    expect((await scenePainterFor("e9")).key).toBe(ENHANCEMENT_PROVIDER.GENERATION);
  });
});
