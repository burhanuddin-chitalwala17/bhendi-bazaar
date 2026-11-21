/**
 * Which model answers (generation-foundation spec R4, R5; trd D4): the setting's order or the
 * default, the capability filter, and fallback on availability only — a refusal is never routed
 * around. Adapters are replaced with fakes; no network is touched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENERATION_FAILURE, GenerationFailure } from "@server/content/generation/generation.types";
import type { Adapter } from "@server/content/generation/adapters/adapter";

const configured = { gateway: true, gemini: true, fal: true };
const calls: string[] = [];
const outcome: Record<string, Buffer | GenerationFailure> = {};
const fake = (key: "gateway" | "gemini" | "fal"): Adapter => ({
  key,
  isConfigured: () => configured[key],
  call: async (model) => {
    calls.push(model.id);
    const result = outcome[model.id] ?? Buffer.from(model.id);
    if (result instanceof GenerationFailure) throw result;
    return result;
  },
});
vi.mock("@server/content/generation/adapters", () => ({
  ADAPTERS: { gateway: fake("gateway"), gemini: fake("gemini"), fal: fake("fal") },
}));

const { eligibleModels, maxReferencesFor, orderedModels, routeCall } = await import("@server/content/generation/router");
const { environmentModelOrder } = await import("@server/content/generation/model-order");

const ask = { references: 1, aspect: "1:1" as const, size: "1K" as const };
const call = { prompt: "p", references: [], aspect: "1:1" as const, size: "1K" as const };

beforeEach(() => {
  Object.assign(configured, { gateway: true, gemini: true, fal: true });
  calls.length = 0;
  for (const key of Object.keys(outcome)) delete outcome[key];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.IMAGE_GEN_MODELS_SCENE;
  delete process.env.IMAGE_GEN_MODELS_LISTING;
  vi.restoreAllMocks();
});

describe("the order", () => {
  it("is the first source that has one, so a stored order can later go in front of the setting", async () => {
    process.env.IMAGE_GEN_MODELS_SCENE = "fal/bria-product-shot";
    const stored = { orderFor: async () => ["cf/flux-2-klein-4b"] };
    const silent = { orderFor: async () => null };
    expect((await orderedModels("scene", [stored, environmentModelOrder])).map((m) => m.id)).toEqual(["cf/flux-2-klein-4b"]);
    expect((await orderedModels("scene", [silent, environmentModelOrder])).map((m) => m.id)).toEqual(["fal/bria-product-shot"]);
  });

  it("is the registry's default for a purpose when nothing is set", async () => {
    expect((await orderedModels("scene")).map((m) => m.id)).toEqual(["cf/flux-2-klein-4b", "fal/bria-product-shot"]);
  });

  it("is the setting's when one is set, and an unknown id is skipped rather than crashing", async () => {
    process.env.IMAGE_GEN_MODELS_SCENE = " fal/bria-product-shot , cf/nonsense, cf/flux-2-klein-4b";
    expect((await orderedModels("scene")).map((m) => m.id)).toEqual(["fal/bria-product-shot", "cf/flux-2-klein-4b"]);
  });
});

describe("the capability filter", () => {
  it("drops a model whose provider is not configured", async () => {
    configured.gateway = false;
    expect((await eligibleModels("scene", ask)).map((m) => m.id)).toEqual(["fal/bria-product-shot"]);
  });

  it("drops a model that cannot take as many references as were sent (Q10)", async () => {
    process.env.IMAGE_GEN_MODELS_LISTING = "cf/nano-banana-pro,gemini/nano-banana-pro";
    expect((await eligibleModels("listing", { ...ask, references: 5 })).map((m) => m.id)).toEqual(["gemini/nano-banana-pro"]);
  });

  it("drops a model that cannot make the shape", async () => {
    expect((await eligibleModels("scene", { ...ask, aspect: "9:16" })).map((m) => m.id)).toEqual(["cf/flux-2-klein-4b"]);
  });

  it("says how many references the first configured model takes: 3 on the gateway, 14 direct (A4)", async () => {
    process.env.IMAGE_GEN_MODELS_LISTING = "cf/nano-banana-pro,gemini/nano-banana-pro";
    expect(await maxReferencesFor("listing")).toBe(3);
    configured.gateway = false;
    expect(await maxReferencesFor("listing")).toBe(14);
  });
});

describe("fallback", () => {
  const models = () => eligibleModels("scene", ask);

  it("uses the first model that answers", async () => {
    await expect(routeCall(await models(), call)).resolves.toMatchObject({ model: { id: "cf/flux-2-klein-4b" } });
    expect(calls).toEqual(["cf/flux-2-klein-4b"]);
  });

  it.each([GENERATION_FAILURE.UNAVAILABLE, GENERATION_FAILURE.NO_CREDIT])("passes on after %s (A2)", async (kind) => {
    outcome["cf/flux-2-klein-4b"] = new GenerationFailure(kind, "x");
    await expect(routeCall(await models(), call)).resolves.toMatchObject({ model: { id: "fal/bria-product-shot" } });
    expect(calls).toEqual(["cf/flux-2-klein-4b", "fal/bria-product-shot"]);
  });

  it.each([GENERATION_FAILURE.REFUSED, GENERATION_FAILURE.BAD_OUTPUT, GENERATION_FAILURE.UNCERTAIN])("stops at %s and tries nothing else (spec R5, D6)", async (kind) => {
    outcome["cf/flux-2-klein-4b"] = new GenerationFailure(kind, "x");
    await expect(routeCall(await models(), call)).rejects.toMatchObject({ kind, modelId: "cf/flux-2-klein-4b" });
    expect(calls).toEqual(["cf/flux-2-klein-4b"]);
  });

  it("reports the last availability failure when every model is down", async () => {
    outcome["cf/flux-2-klein-4b"] = new GenerationFailure(GENERATION_FAILURE.UNAVAILABLE, "a");
    outcome["fal/bria-product-shot"] = new GenerationFailure(GENERATION_FAILURE.NO_CREDIT, "b");
    await expect(routeCall(await models(), call)).rejects.toMatchObject({ kind: GENERATION_FAILURE.NO_CREDIT });
  });
});
