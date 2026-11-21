/**
 * The scene, end to end below the provider (image-enhancement spec R4, R11, A3; trd D2, D4, D6).
 *
 * The settings are a fixed list an org picks from and the boundary holds it to that list; the tool
 * cuts the product out, asks for a setting, and pastes **our** cut-out back over what came home, so
 * the product in the result is the product we put there whatever the service drew. The painter and
 * the segmenter are stubs and sharp does the real work, so nothing here needs a service, a key or a
 * balance.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { DomainError } from "@server/shared/domain-error";
import {
  ENHANCEMENT_PROVIDER,
  ENHANCEMENT_TOOL,
  MODEL_SEGMENT_PAISE,
  runCostPaise,
} from "@server/content/enhancement.types";
import {
  SCENE_ASPECT,
  SCENE_ASPECT_COPY,
  SCENE_PRESET,
  SCENE_PRESETS,
  SCENE_PRESET_KEYS,
  scenePresetFor,
} from "@server/content/scene-presets";
import type { Segmenter } from "@server/content/providers/segment";
import type { ScenePainter } from "@server/content/providers/scene";
import type { Placement } from "@server/content/tools/pixel-identity";
import { requestEnhancementSchema } from "@/lib/validation/schemas/enhancement.schema";

const { guard } = vi.hoisted(() => ({ guard: vi.fn() }));
vi.mock("@server/content/tools/pixel-identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@server/content/tools/pixel-identity")>();
  guard.mockImplementation(actual.assertProductPixelsKept);
  return { assertProductPixelsKept: guard };
});

const identity = await vi.importActual<typeof import("@server/content/tools/pixel-identity")>(
  "@server/content/tools/pixel-identity",
);
const { inScene, sceneCanvas } = await import("@server/content/tools/scene");

const PRODUCT = { r: 200, g: 30, b: 40 };
/** What a service might draw where the product goes. It must not survive into the result. */
const IMPOSTOR = { r: 20, g: 190, b: 60 };
const BACKDROP = { r: 30, g: 80, b: 170 };
/** The composite is exact; WebP then moves a colour by a hair, which is why the check runs first. */
const ENCODER_SLACK = 6;

const source = { bytes: Buffer.from("the photograph"), objectKey: "products/org-1/a.webp", mimeType: "image/webp" };
const table = SCENE_PRESET["wooden-table"];
const drape = SCENE_PRESET["fabric-drape"];

/** A cut-out as a service hands one back: a block of product on nothing at all. */
async function cutOutFixture(): Promise<Buffer> {
  const product = await sharp({
    create: { width: 200, height: 150, channels: 4, background: { ...PRODUCT, alpha: 1 } },
  })
    .png()
    .toBuffer();
  return await sharp({ create: { width: 400, height: 320, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: product, left: 120, top: 90 }])
    .png()
    .toBuffer();
}

/** A painted scene, optionally with the product redrawn in the middle of it. */
async function paintedFixture(width: number, height: number, redrawn = false): Promise<Buffer> {
  const canvas = sharp({ create: { width, height, channels: 3, background: BACKDROP } });
  if (!redrawn) return await canvas.png().toBuffer();
  const block = await sharp({ create: { width: 180, height: 140, channels: 3, background: IMPOSTOR } })
    .png()
    .toBuffer();
  return await canvas
    .composite([{ input: block, left: Math.round((width - 180) / 2), top: Math.round((height - 140) / 2) }])
    .png()
    .toBuffer();
}

function stubSegmenter(bytes: Buffer): Segmenter {
  return { key: ENHANCEMENT_PROVIDER.ZONE, isAvailable: () => true, cutOut: vi.fn().mockResolvedValue(bytes) };
}

function stubPainter(bytes: Buffer): ScenePainter {
  return { key: ENHANCEMENT_PROVIDER.MODEL, isAvailable: () => true, paint: vi.fn().mockResolvedValue(bytes) };
}

async function pixels(bytes: Buffer) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    at: (x: number, y: number) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)],
  };
}

const near = (got: number[], want: { r: number; g: number; b: number }, slack: number) =>
  Math.abs(got[0] - want.r) <= slack && Math.abs(got[1] - want.g) <= slack && Math.abs(got[2] - want.b) <= slack;

/** One channel of one pixel, moved by one — the size of change a quiet redraw would make. */
async function nudge(bytes: Buffer, x: number, y: number, channel: number): Promise<Buffer> {
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * info.channels + channel;
  data[at] = data[at] === 255 ? 254 : data[at] + 1;
  return await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

beforeEach(() => {
  guard.mockClear();
});

describe("the settings are a list the platform owner wrote", () => {
  it("has the five the owner approved, each keyed by the name it is addressed under", () => {
    expect(SCENE_PRESETS).toHaveLength(5);
    expect(SCENE_PRESET_KEYS).toEqual([
      "wooden-table",
      "marble-counter",
      "shop-shelf",
      "fabric-drape",
      "studio-colour",
    ]);
    for (const [key, preset] of Object.entries(SCENE_PRESET)) expect(preset.key).toBe(key);
    expect(new Set(SCENE_PRESET_KEYS).size).toBe(SCENE_PRESET_KEYS.length);
  });

  it("gives every one a label a phone can show and words a service can use", () => {
    for (const preset of SCENE_PRESETS) {
      expect(preset.label.trim().length, `${preset.key} has no label`).toBeGreaterThan(0);
      expect(preset.label.length, `"${preset.label}" is long for a tile`).toBeLessThanOrEqual(40);
      expect(preset.label).not.toMatch(/[—–]/);
      expect(preset.prompt.trim().length, `${preset.key} has no prompt`).toBeGreaterThan(20);
      expect(Object.values(SCENE_ASPECT)).toContain(preset.aspect);
    }
  });

  it("offers both shapes, and says which is which before a run is spent", () => {
    const aspects = new Set(SCENE_PRESETS.map((preset) => preset.aspect));
    expect(aspects.has(SCENE_ASPECT.SQUARE)).toBe(true);
    expect(aspects.has(SCENE_ASPECT.PORTRAIT)).toBe(true);
    for (const aspect of Object.values(SCENE_ASPECT)) expect(SCENE_ASPECT_COPY[aspect].length).toBeGreaterThan(0);
  });

  it("resolves a stored key, and answers null for one the list no longer has", () => {
    expect(scenePresetFor("wooden-table")).toBe(table);
    expect(scenePresetFor("a sunlit beach in goa")).toBeNull();
    expect(scenePresetFor(null)).toBeNull();
    expect(scenePresetFor("")).toBeNull();
  });
});

describe("the boundary holds a request to that list", () => {
  const photo = { sourceRef: "https://img.test/a.webp" };

  it("takes a scene with a setting from the list", () => {
    const parsed = requestEnhancementSchema.parse({ tool: ENHANCEMENT_TOOL.SCENE, preset: "shop-shelf", ...photo });
    expect(parsed.preset).toBe("shop-shelf");
  });

  it("refuses a setting nobody wrote, which is how a typed prompt would arrive", () => {
    const typed = requestEnhancementSchema.safeParse({
      tool: ENHANCEMENT_TOOL.SCENE,
      preset: "on a beach in goa at sunset",
      ...photo,
    });
    expect(typed.success).toBe(false);
  });

  it("refuses a scene with no setting at all", () => {
    const parsed = requestEnhancementSchema.safeParse({ tool: ENHANCEMENT_TOOL.SCENE, ...photo });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(["preset"]);
  });

  it("refuses a setting on a tool that has none to choose", () => {
    const parsed = requestEnhancementSchema.safeParse({
      tool: ENHANCEMENT_TOOL.WHITE,
      preset: "wooden-table",
      ...photo,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(["preset"]);
    expect(requestEnhancementSchema.safeParse({ tool: ENHANCEMENT_TOOL.WHITE, ...photo }).success).toBe(true);
  });
});

describe("inScene", () => {
  it("asks the painter for the preset's setting, and hands it the cut-out rather than the photo", async () => {
    const painter = stubPainter(await paintedFixture(400, 400));
    await inScene(source, stubSegmenter(await cutOutFixture()), painter, table);

    expect(painter.paint).toHaveBeenCalledTimes(1);
    const [asked] = (painter.paint as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(asked.prompt).toBe(table.prompt);
    expect(asked.aspect).toBe(table.aspect);
    // What it is given is a cut-out, not the photograph: transparent, and not the source bytes.
    expect((await sharp(asked.cutout).metadata()).hasAlpha).toBe(true);
    expect(asked.cutout.equals(source.bytes)).toBe(false);
  });

  it("keeps the product's own pixels exactly, and only then encodes", async () => {
    const result = await inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(await paintedFixture(400, 400)), table);

    // The guard ran on the composite before the WebP, and the composite it saw was exact — the
    // real implementation is behind the spy, so an inexact one would have thrown.
    expect(guard).toHaveBeenCalledTimes(1);
    const [placed, composed, at] = guard.mock.calls[0] as [Buffer, Buffer, Placement];
    expect((await sharp(composed).metadata()).format).toBe("png");
    await expect(identity.assertProductPixelsKept(placed, composed, at)).resolves.toBeUndefined();

    expect(result.mimeType).toBe("image/webp");
    const map = await pixels(result.output);
    expect(near(map.at(Math.round(map.width / 2), Math.round(map.height / 2)), PRODUCT, ENCODER_SLACK)).toBe(true);
    expect(near(map.at(2, 2), BACKDROP, ENCODER_SLACK), "the setting is the service's").toBe(true);
  });

  it("covers a product the service redrew with our own, which is the whole promise (spec R4)", async () => {
    const result = await inScene(
      source,
      stubSegmenter(await cutOutFixture()),
      stubPainter(await paintedFixture(400, 400, true)),
      table,
    );
    const map = await pixels(result.output);
    const centre = map.at(Math.round(map.width / 2), Math.round(map.height / 2));
    expect(near(centre, PRODUCT, ENCODER_SLACK), "ours").toBe(true);
    expect(near(centre, IMPOSTOR, ENCODER_SLACK), "theirs").toBe(false);
  });

  it("fails the run when the product in the composite changed, rather than proposing it", async () => {
    // Mutation-style: one channel of one pixel inside the product, moved by one. If the paste-back
    // ever stopped covering what the service drew, this is the size of the difference it would
    // leave, and the run must go red rather than put it in front of an org member.
    guard.mockImplementationOnce(async (cut: Buffer, composed: Buffer, at: Placement) =>
      identity.assertProductPixelsKept(cut, await nudge(composed, at.left + 20, at.top + 20, 1), at),
    );
    await expect(
      inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(await paintedFixture(400, 400)), table),
    ).rejects.toThrow(/changed the product itself/);
  });

  it("proposes nothing when the check refuses, whatever the reason", async () => {
    const refusal = new DomainError("The improvement changed the product itself, so it was not kept");
    guard.mockRejectedValueOnce(refusal);
    await expect(
      inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(await paintedFixture(400, 400)), table),
    ).rejects.toBe(refusal);
  });

  it("is square for a listing's preset and tall for Instagram's", async () => {
    const square = await inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(await paintedFixture(400, 400)), table);
    expect(square.width).toBe(square.height);

    const tall = await inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(await paintedFixture(500, 500)), drape);
    expect(tall.height).toBeGreaterThan(tall.width);
    expect(tall.width / tall.height).toBeCloseTo(0.8, 2);
  });

  it("takes the shape from the preset even where the service answered with another one", async () => {
    // A service that ignores the aspect it was asked for gets cropped to ours, never stretched.
    const tall = await inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(await paintedFixture(600, 400)), drape);
    expect(tall.width / tall.height).toBeCloseTo(0.8, 2);
  });

  it("says so when the scene comes back as something we cannot read", async () => {
    await expect(
      inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(Buffer.from("not a picture")), table),
    ).rejects.toBeInstanceOf(DomainError);
    await expect(
      inScene(source, stubSegmenter(await cutOutFixture()), stubPainter(Buffer.from("not a picture")), table),
    ).rejects.toThrow(/could not read/);
  });
});

describe("the canvas a preset asks for", () => {
  it("is the preset's shape at the painted scene's own resolution, never past the ceiling", () => {
    expect(sceneCanvas(table, { width: 400, height: 400 })).toEqual({ width: 400, height: 400 });
    expect(sceneCanvas(drape, { width: 500, height: 500 })).toEqual({ width: 400, height: 500 });
    // A service that answered enormous is capped at what the store keeps (ADR-0026).
    expect(sceneCanvas(table, { width: 6000, height: 6000 })).toEqual({ width: 2048, height: 2048 });
  });
});

describe("what a scene run costs", () => {
  it("prices the paint at nothing in the table: its cost is the generation row's (generation-foundation D7)", () => {
    expect(
      runCostPaise([
        { tool: ENHANCEMENT_TOOL.CUTOUT, provider: ENHANCEMENT_PROVIDER.ZONE },
        { tool: ENHANCEMENT_TOOL.SCENE, provider: ENHANCEMENT_PROVIDER.GENERATION },
      ]),
    ).toBe(0);

    // The cut-out from the paid model is still the table's: a scene costs a cut-out *and* a paint.
    expect(
      runCostPaise([
        { tool: ENHANCEMENT_TOOL.CUTOUT, provider: ENHANCEMENT_PROVIDER.MODEL },
        { tool: ENHANCEMENT_TOOL.SCENE, provider: ENHANCEMENT_PROVIDER.GENERATION },
      ]),
    ).toBe(MODEL_SEGMENT_PAISE);
  });

  it("still prices a one-step run as that one step", () => {
    expect(runCostPaise([{ tool: ENHANCEMENT_TOOL.WHITE, provider: ENHANCEMENT_PROVIDER.MODEL }])).toBe(MODEL_SEGMENT_PAISE);
    expect(runCostPaise([{ tool: ENHANCEMENT_TOOL.WHITE, provider: ENHANCEMENT_PROVIDER.ZONE }])).toBe(0);
    expect(runCostPaise([{ tool: ENHANCEMENT_TOOL.LIGHT, provider: ENHANCEMENT_PROVIDER.SHARP }])).toBe(0);
    expect(runCostPaise([])).toBe(0);
  });
});
