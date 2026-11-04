/**
 * The framing on the wire and in the column (image-slots trd D4, D8): what the route refuses, what
 * the reader falls back to, the phone fallback, and the migration's backfill literal parsing with
 * the stored schema so the two cannot drift.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { imageSlotInputSchema } from "@/lib/validation/schemas/image-slot.schema";
import {
  DEFAULT_FRAMING,
  imageFramingSchema,
  readImageFraming,
  toImageSlotValue,
  toResponsiveImage,
} from "@server/catalog/image-framing";

const URL_A = "https://cdn.bhendi-bazaar.com/a.webp";
const URL_B = "https://cdn.bhendi-bazaar.com/b.webp";

describe("imageSlotInputSchema", () => {
  const side = { url: URL_A, fit: "crop" };

  it("accepts one form factor alone and defaults the phone focus to the centre", () => {
    const parsed = imageSlotInputSchema.parse({ desktop: side });
    expect(parsed.phone).toBeNull();
    expect(parsed.phoneFocus).toEqual({ x: 0.5, y: 0.5 });
  });

  it("refuses Fit it in without a colour, and a colour that is not #rrggbb", () => {
    expect(imageSlotInputSchema.safeParse({ desktop: { ...side, fit: "contain" } }).success).toBe(false);
    for (const fill of ["red", "#fff", "rgb(0,0,0)", "#12345g", "#ffffff; background:url(x)"]) {
      expect(imageSlotInputSchema.safeParse({ desktop: { ...side, fit: "contain", fill } }).success).toBe(false);
    }
    expect(imageSlotInputSchema.safeParse({ desktop: { ...side, fit: "contain", fill: "#1a2b3c" } }).success).toBe(true);
  });

  it("refuses a frame past the picture's edge, or empty", () => {
    const frame = (crop: object) => imageSlotInputSchema.safeParse({ desktop: { ...side, crop } }).success;
    expect(frame({ x: 0.5, y: 0, width: 0.6, height: 1 })).toBe(false);
    expect(frame({ x: 0, y: 0, width: 0, height: 1 })).toBe(false);
    expect(frame({ x: -0.1, y: 0, width: 0.5, height: 1 })).toBe(false);
    expect(frame({ x: 0.4, y: 0, width: 0.6, height: 1 })).toBe(true);
  });

  it("refuses a focus point off the picture, and an unknown fit", () => {
    expect(imageSlotInputSchema.safeParse({ desktop: side, phoneFocus: { x: 1.2, y: 0 } }).success).toBe(false);
    expect(imageSlotInputSchema.safeParse({ desktop: { ...side, fit: "stretch" } }).success).toBe(false);
  });

  it("strips the sizes the field measured: the asset's own are the ones that count", () => {
    const parsed = imageSlotInputSchema.parse({ desktop: { ...side, width: 1, height: 1 } });
    expect(parsed.desktop).not.toHaveProperty("width");
  });
});

describe("the stored framing", () => {
  it("parses the backfill the migration writes", () => {
    const dir = readdirSync("prisma/migrations").find((name) => name.endsWith("_image_slots"));
    const sql = readFileSync(join("prisma/migrations", dir!, "migration.sql"), "utf8");
    const literals = [...sql.matchAll(/'(\{.*?\})'::jsonb/g)].map((m) => m[1]);
    expect(literals).toHaveLength(3);
    for (const literal of literals) expect(imageFramingSchema.parse(JSON.parse(literal))).toEqual(DEFAULT_FRAMING);
  });

  it("reads garbage, or nothing, as the default rather than failing the page", () => {
    expect(readImageFraming(null)).toEqual(DEFAULT_FRAMING);
    expect(readImageFraming({ desktop: { fit: "stretch" } })).toEqual(DEFAULT_FRAMING);
  });
});

describe("toResponsiveImage", () => {
  it("renders a banner saved before image slots exactly as before: cover, centred, on both", () => {
    const image = toResponsiveImage({ imageUrl: URL_A, phoneImageUrl: null, imageFraming: null }, "Eid");
    expect(image).toEqual({
      alt: "Eid",
      desktop: { src: URL_A, fit: "crop", position: { x: 0.5, y: 0.5 }, fill: null },
      phone: { src: URL_A, fit: "crop", position: { x: 0.5, y: 0.5 }, fill: null },
    });
  });

  it("gives phones the desktop picture around the chosen focus when there is no phone version", () => {
    const framing = { ...DEFAULT_FRAMING, phoneFocus: { x: 0.8, y: 0.3 } };
    const image = toResponsiveImage({ imageUrl: URL_A, phoneImageUrl: null, imageFraming: framing }, "");
    expect(image?.phone).toEqual({ src: URL_A, fit: "crop", position: { x: 0.8, y: 0.3 }, fill: null });
  });

  it("gives phones their own picture, with its own framing, when there is one", () => {
    const framing = {
      desktop: DEFAULT_FRAMING.desktop,
      phone: { fit: "contain", crop: null, sourceWidth: 900, sourceHeight: 1000, fill: "#102030", position: { x: 0.5, y: 0.5 } },
      phoneFocus: { x: 0.5, y: 0.5 },
    };
    const image = toResponsiveImage({ imageUrl: URL_A, phoneImageUrl: URL_B, imageFraming: framing }, "");
    expect(image?.phone).toEqual({ src: URL_B, fit: "contain", position: { x: 0.5, y: 0.5 }, fill: "#102030" });
    expect(image?.desktop.src).toBe(URL_A);
  });

  it("is nothing when no picture is renderable", () => {
    expect(toResponsiveImage({ imageUrl: null, phoneImageUrl: null, imageFraming: null }, "")).toBeNull();
  });

  it("hands the editor the crop back as fractions", () => {
    const framing = {
      ...DEFAULT_FRAMING,
      desktop: { fit: "crop", crop: { x: 0, y: 20, width: 1600, height: 640 }, sourceWidth: 1600, sourceHeight: 660, fill: null, position: { x: 0.5, y: 1 } },
    };
    const value = toImageSlotValue({ imageUrl: URL_A, phoneImageUrl: null, imageFraming: framing });
    expect(value?.desktop?.crop?.y).toBeCloseTo(20 / 660);
    expect(value?.desktop?.crop?.width).toBe(1);
  });
});
