import { describe, expect, it } from "vitest";

import {
  factColumns,
  measureColumns,
  measureHeader,
  tabColumns,
  VIDEO_HELP,
} from "@server/catalog/bulk/sheet-columns";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * The sheet's columns are worked out from the types it is generated for, never fixed.
 *
 * That is the property worth holding: a template written down once goes stale the first time a
 * product type or a fact is added, and the drift is invisible until somebody's upload is
 * rejected for a column that no longer exists. These tests say the columns *follow* the types,
 * by giving them types the codebase has never seen.
 */
const type = (over: Partial<ProductTypeRecord>): ProductTypeRecord => ({
  key: "t",
  label: "T",
  facts: [],
  measures: [],
  variantAxis: [],
  kinds: [],
  factLabels: {},
  labelFrom: [],
  labelScale: null,
  ...over,
});

const garment = type({
  key: "islamic-wear",
  label: "Islamic wear",
  facts: ["colour", "material", "sleeveLength"],
  factLabels: { material: "Fabric" },
  measures: [
    { key: "length", label: "Length", unit: "in", required: true },
    { key: "bust", label: "Bust", unit: "in", required: true },
  ],
});

const keys = (columns: { key: string }[]) => columns.map((column) => column.key);

const mat = type({
  key: "prayer-mat",
  label: "Prayer mat",
  facts: ["colour", "material", "shape"],
  measures: [
    { key: "length", label: "Length", unit: "cm", required: true },
    { key: "width", label: "Width", unit: "cm", required: false },
  ],
});

describe("the columns follow the type, not a template", () => {
  it("asks only what the given type asks", () => {
    expect(keys(factColumns(garment))).toEqual(["colour", "material", "sleeveLength"]);
    expect(keys(factColumns(garment))).not.toContain("shape");
  });

  // A type the codebase has never heard of still produces its columns, which is what
  // "generated at runtime" has to mean to be worth the words.
  it("follows a type invented after this test was written", () => {
    const shoes = type({
      key: "footwear",
      label: "Footwear",
      facts: ["colour", "closure"],
      measures: [{ key: "length", label: "Length", unit: "mm", required: true }],
      kinds: [{ key: "sandal", label: "Sandal" }],
    });
    const columns = keys(tabColumns(shoes, []));
    expect(columns).toContain("closure");
    expect(columns).toContain("length (mm)");
    expect(columns).toContain("kind");
  });

  it("carries no fact, measure or kind column for the Other tab", () => {
    expect(keys(tabColumns(null, []))).toEqual([
      "name", "description", "price", "salePrice", "category", "family", "sku",
      "weight", "tags", "images", "cover", "video",
    ]);
  });

  it("adds a stock column per pickup location, headed for people and keyed for the reader", () => {
    const [stock] = tabColumns(null, ["Crawford"]).filter((c) => c.key.startsWith("stock:"));
    expect(stock).toMatchObject({ key: "stock:Crawford", heading: "Stock at Crawford" });
  });
});

describe("a measurement column names its unit", () => {
  // `length` is inches for a garment and centimetres for a mat; the key carries the unit.
  it("keys the column by measure and unit", () => {
    expect(keys(measureColumns(garment))).toContain("length (in)");
    expect(keys(measureColumns(mat))).toContain("length (cm)");
    expect(measureHeader("capacity", "ml")).toBe("capacity (ml)");
  });

  it("marks a required measure required and says optional otherwise", () => {
    const [length, width] = measureColumns(mat);
    expect(length.required).toBe(true);
    expect(width.required).toBe(false);
    expect(width.help).toContain("Optional");
  });
});

describe("what the headings and help line tell the person filling it", () => {
  it("heads a shared fact in this type's own word for it", () => {
    expect(factColumns(garment).find((c) => c.key === "material")?.heading).toBe("Fabric");
    expect(factColumns(mat).find((c) => c.key === "material")?.heading).toBe("Material");
  });

  it("says that a matching SKU updates rather than creates", () => {
    expect(tabColumns(null, []).find((c) => c.key === "sku")?.help).toContain("updates it");
  });

  it("marks the columns a row is refused without", () => {
    const required = tabColumns(null, []).filter((c) => c.required).map((c) => c.key);
    expect(required).toEqual(["name", "description", "price", "category", "weight", "images"]);
  });

  it("says the Video column takes a YouTube link only (R11, Q25)", () => {
    expect(tabColumns(null, []).find((c) => c.key === "video")?.help).toBe(VIDEO_HELP);
    expect(VIDEO_HELP).toBe("YouTube link only. Add a video file from the product form after upload.");
  });
});
