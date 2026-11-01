import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildProductSampleSheet, FAMILY_WARNING, LIST_STOP } from "@server/catalog/bulk/sample-sheet";
import { LIST_HELP } from "@server/catalog/bulk/sheet-columns";
import { categoryMatcher, planSheetTabs } from "@server/catalog/bulk/sheet-tabs";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { editDistance, notInListMessage, wordMatcher, YES_NO } from "@server/catalog/bulk/word-match";
import { parseBulkProductRow } from "@/lib/validation/schemas/bulk-product.schema";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * own-store/bulk-sheet U2: every platform value a dropdown of words on a hidden Lists tab (R2, A2,
 * D3), and typed words matched whatever their case, spacing or punctuation (R5, D5, D6).
 */
const abaya: ProductTypeRecord = {
  key: "abaya",
  label: "Abaya",
  facts: ["colour", "material", "waterResistant"],
  factLabels: { material: "Fabric" },
  measures: [],
  variantAxis: [],
  kinds: [{ key: "abaya", label: "Abaya" }, { key: "open-abaya", label: "Front open" }],
  labelFrom: [],
  labelScale: null,
};

const categories = [
  { id: "women", parentId: null, slug: "women", name: "Women", productType: null },
  { id: "abayas", parentId: "women", slug: "abayas", name: "Abayas", productType: "abaya" },
  { id: "kids", parentId: null, slug: "kids", name: "Kids", productType: null },
  { id: "kid-abayas", parentId: "kids", slug: "kids-abayas", name: "Abayas", productType: "abaya" },
];

async function workbook(over: { brands?: string[] } = {}) {
  const buffer = await buildProductSampleSheet({
    orgName: "Noor",
    madeOn: new Date("2026-10-30T10:00:00Z"),
    locationNames: ["Shop"],
    tabs: planSheetTabs(["abayas", "kid-abayas"], categories, [abaya]),
    values: { colour: [{ key: "emerald", label: "Emerald" }, { key: "black", label: "Black" }], material: [{ key: "nida", label: "Nida" }] },
    categoryPaths: { abayas: "Women › Abayas", "kids-abayas": "Kids › Abayas" },
    families: ["Emerald range"],
    brands: over.brands ?? ["Noor Studio"],
  });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ArrayBuffer);
  return book;
}

const keysOf = (sheet: ExcelJS.Worksheet) => (sheet.getRow(2).values as unknown[]).map((v) => String(v ?? ""));

/** The words a cell's dropdown offers, read off the Lists tab it points at. */
function offered(book: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, key: string): unknown[] {
  const validation = sheet.getCell(5, keysOf(sheet).indexOf(key)).dataValidation;
  const [range] = (validation?.formulae ?? []) as string[];
  const match = /^Lists!\$([A-Z]+)\$(\d+):\$[A-Z]+\$(\d+)$/.exec(range ?? "");
  if (!match) return [];
  const lists = book.getWorksheet("Lists")!;
  const words = [];
  for (let row = Number(match[2]); row <= Number(match[3]); row += 1) words.push(lists.getCell(`${match[1]}${row}`).value);
  return words;
}

describe("A2 — every list column opens a dropdown", () => {
  it("puts one on category, kind, family, brand, every answer and yes/no, each from Lists", async () => {
    const book = await workbook();
    const tab = book.getWorksheet("Abaya")!;
    for (const key of ["category", "kind", "family", "brand", "colour", "material", "waterResistant"]) {
      const validation = tab.getCell(5, keysOf(tab).indexOf(key)).dataValidation;
      expect(validation?.type, key).toBe("list");
      expect(String(validation?.formulae?.[0]), key).toMatch(/^Lists!/);
    }
  });

  it("keeps the Lists tab hidden", async () => {
    expect((await workbook()).getWorksheet("Lists")!.state).toBe("veryHidden");
  });

  it("has no Brand column for a shop with no brand", async () => {
    expect(keysOf((await workbook({ brands: [] })).getWorksheet("Abaya")!)).not.toContain("brand");
  });
});

describe("R2 — dropdowns show the words a person reads", () => {
  it("offers categories as paths, so two Abayas stay apart (Q6)", async () => {
    const book = await workbook();
    expect(offered(book, book.getWorksheet("Abaya")!, "category")).toEqual(["Kids › Abayas", "Women › Abayas"]);
  });

  it("offers kinds, answers, brands and yes/no as labels, not keys", async () => {
    const book = await workbook();
    const tab = book.getWorksheet("Abaya")!;
    expect(offered(book, tab, "kind")).toEqual(["Abaya", "Front open"]);
    expect(offered(book, tab, "colour")).toEqual(["Emerald", "Black"]);
    expect(offered(book, tab, "brand")).toEqual(["Noor Studio"]);
    expect(offered(book, tab, "waterResistant")).toEqual(["Yes", "No"]);
    expect(offered(book, tab, "family")).toEqual(["Emerald range"]);
  });

  it("stops a typed value on every list but family, which only warns (Q7)", async () => {
    const book = await workbook();
    const tab = book.getWorksheet("Abaya")!;
    const at = (key: string) => tab.getCell(5, keysOf(tab).indexOf(key)).dataValidation!;
    expect(at("colour")).toMatchObject({ showErrorMessage: true, errorStyle: "stop", error: LIST_STOP });
    expect(at("category")).toMatchObject({ errorStyle: "stop", error: "Pick from the list in this column." });
    expect(at("family")).toMatchObject({ showErrorMessage: true, errorStyle: "warning", error: FAMILY_WARNING });
  });

  it("tells a phone app user where the lists are, on the help line and on Instructions", async () => {
    const book = await workbook();
    const tab = book.getWorksheet("Abaya")!;
    expect(tab.getCell(3, keysOf(tab).indexOf("colour")).value).toBe(
      "Pick from the list. On a phone app without lists, copy a value from the Lists guide on Instructions.",
    );
    expect(tab.getCell(3, keysOf(tab).indexOf("category")).value).toBe(LIST_HELP);
    const text = book.getWorksheet("Instructions")!.getColumn(1).values.map(String).join("\n");
    expect(text).toContain("Lists guide");
    expect(text).toContain("Category on Abaya: Kids › Abayas · Women › Abayas");
    expect(text).toContain("Fabric: Nida");
    expect(text).toContain("Yes or no: Yes · No");
  });

  it("fills the example with words from the lists", async () => {
    const tab = (await workbook()).getWorksheet("Abaya")!;
    const keys = keysOf(tab);
    expect(tab.getCell(4, keys.indexOf("category")).value).toBe("Kids › Abayas");
    expect(tab.getCell(4, keys.indexOf("kind")).value).toBe("Abaya");
  });
});

describe("D6 — typed words find their listed value", () => {
  const colours = wordMatcher([
    { value: "emerald", label: "Emerald", words: ["Emerald", "emerald"] },
    { value: "navy-blue", label: "Navy Blue", words: ["Navy Blue", "navy-blue"] },
  ]);

  it("ignores case, spacing and punctuation, and takes the key", () => {
    expect(colours.match("  EMERALD ")).toBe("emerald");
    expect(colours.match("navy-blue")).toBe("navy-blue");
    expect(colours.match("Navy  blue.")).toBe("navy-blue");
    expect(colours.match("navyblue")).toBe("navy-blue");
    expect(colours.match("Emrald")).toBeUndefined();
    expect(colours.match("")).toBeUndefined();
  });

  it("names the closest listed value only when it is a slip", () => {
    expect(colours.closest("Emrald")).toBe("Emerald");
    expect(colours.closest("Nvay Blue")).toBe("Navy Blue");
    expect(colours.closest("Gold")).toBeUndefined();
  });

  it("counts a swapped pair as one slip", () => {
    expect(editDistance("yse", "yes")).toBe(1);
    expect(wordMatcher(YES_NO).closest("Yse")).toBe("Yes");
  });

  it("reads yes and no however a sheet spells them", () => {
    const yesNo = wordMatcher(YES_NO);
    expect([yesNo.match("YES"), yesNo.match("y"), yesNo.match("No"), yesNo.match("false")]).toEqual([true, true, false, false]);
    expect(yesNo.match("maybe")).toBeUndefined();
  });

  it("words A4's problem line, with the suggestion after it", () => {
    expect(notInListMessage("Colour", "Emrald", "Emerald")).toBe(
      "Colour 'Emrald' isn't in the list — pick from the dropdown. Did you mean 'Emerald'?",
    );
    expect(notInListMessage("Colour", "Gold", undefined)).toBe("Colour 'Gold' isn't in the list — pick from the dropdown");
  });

  it("refuses a word two values share rather than guessing", () => {
    const twins = wordMatcher([
      { value: 1, label: "A-B", words: ["A-B"] },
      { value: 2, label: "AB", words: ["A B"] },
    ]);
    expect(twins.match("a-b")).toBe(1);
    expect(twins.match("a.b")).toBeUndefined();
  });
});

describe("D6 — a category by path or slug, never a bare name", () => {
  const match = categoryMatcher(categories);

  it("matches the full path, however spaced", () => {
    expect(match.match("Women › Abayas")?.id).toBe("abayas");
    expect(match.match("kids›abayas")?.id).toBe("kid-abayas");
  });

  it("matches a slug", () => {
    expect(match.match("kids-abayas")?.id).toBe("kid-abayas");
  });

  it("never matches a bare name two categories share", () => {
    // "Abayas" is also Women › Abayas's slug, but a seller typing it may mean the kids' one.
    expect(match.match("Abayas")).toBeUndefined();
    expect(match.match("abayas")).toBeUndefined();
    expect(match.match("Kids Abayas")?.id).toBe("kid-abayas");
    expect(categoryMatcher(categories.map((c) => ({ ...c, slug: `${c.id}-x` }))).match("Abayas")).toBeUndefined();
  });

  it("suggests the nearest path on a miss", () => {
    expect(match.closest("Women › Abaya")).toBe("Women › Abayas");
  });
});

describe("D5 — what the reader keeps of each cell", () => {
  it("keeps each cell's address and a category as typed", async () => {
    const book = await workbook();
    const tab = book.getWorksheet("Abaya")!;
    const keys = keysOf(tab);
    tab.getCell(5, keys.indexOf("name")).value = "Emerald abaya";
    tab.getCell(5, keys.indexOf("colour")).value = "Emrald";
    tab.getCell(5, keys.indexOf("category")).value = "Women › Abayas";
    const sheet = await parseSheet(Buffer.from(await book.xlsx.writeBuffer()), "sheet.xlsx");
    const [row] = sheet.rows;
    const column = tab.getColumn(keys.indexOf("colour")).letter;
    expect(row.addresses?.colour).toBe(`${column}5`);
    expect(row.cells.colour).toBe("Emrald");
    const parsed = parseBulkProductRow(row);
    expect("errors" in parsed ? parsed.errors : []).not.toContainEqual(expect.objectContaining({ field: "categorySlug" }));
    if ("row" in parsed) expect(parsed.row.categorySlug).toBe("Women › Abayas");
  });

  // Q28: a sheet with no stamp is dated by its file.
  it("dates an .xlsx by its own creation date, and a .csv not at all", async () => {
    const book = new ExcelJS.Workbook();
    book.created = new Date("2026-09-12T08:00:00Z");
    const sheet = book.addWorksheet("Products");
    sheet.addRow(["name", "price"]);
    sheet.addRow(["Rose attar", "499"]);
    const read = await parseSheet(Buffer.from(await book.xlsx.writeBuffer()), "old.xlsx");
    expect(read.createdOn?.toISOString()).toBe("2026-09-12T08:00:00.000Z");
    expect(read.rows[0].addresses).toEqual({ name: "A2", price: "B2" });
    const csv = await parseSheet(Buffer.from("name,price\nRose attar,499\n"), "old.csv");
    expect(csv.createdOn).toBeNull();
  });
});

describe("R5 — a row's words are checked whatever the dropdown allowed", async () => {
  const { resolveRowVocabulary } = await import("@server/catalog/bulk/bulk-vocabulary");
  const context = {
    types: new Map([[abaya.key, abaya]]),
    valueKeys: new Map([["colour", wordMatcher([{ value: "emerald", label: "Emerald", words: ["Emerald", "emerald"] }])]]),
    brands: wordMatcher([{ value: "brand-1", label: "Noor Studio", words: ["Noor Studio"] }]),
    categories: [{ id: "abayas", parentId: null, productType: "abaya" }],
  };
  const resolve = (over: Record<string, unknown>) =>
    resolveRowVocabulary(
      { name: "n", description: "d", price: 1, categorySlug: "abayas", weight: 1, tags: [], images: [], stock: {}, factLabels: {}, measurements: {}, ...over },
      7,
      "abayas",
      context,
    );

  it("refuses a yes/no answer that is neither, rather than reading it as no", () => {
    expect(resolve({ factLabels: { waterResistant: "yes" } }).resolved.facts.waterResistant?.value).toBe(true);
    expect(resolve({ factLabels: { waterResistant: "Yse" } }).errors).toEqual([
      { row: 7, field: "waterResistant", message: "Water resistant 'Yse' isn't in the list — pick from the dropdown. Did you mean 'Yes'?" },
    ]);
  });

  it("A4 — names Colour 'Emrald' with its closest, and keeps nothing for it", () => {
    const { resolved, errors } = resolve({ factLabels: { colour: "Emrald" } });
    expect(errors[0]?.message).toBe("Colour 'Emrald' isn't in the list — pick from the dropdown. Did you mean 'Emerald'?");
    expect(resolved.facts.colour).toBeUndefined();
  });

  it("heads a problem with the type's own word for the fact", () => {
    expect(resolve({ factLabels: { material: "Silk" } }).errors[0]?.message).toMatch(/^Fabric 'Silk'/);
  });

  it("reads a kind and a brand by their words", () => {
    const { resolved, errors } = resolve({ kind: "FRONT-OPEN", brandName: "noor studio" });
    expect(errors).toEqual([]);
    expect(resolved).toMatchObject({ kind: "open-abaya", brandId: "brand-1" });
    expect(resolve({ kind: "Frnt open" }).errors[0]?.message).toBe(
      "Kind 'Frnt open' isn't in the list — pick from the dropdown. Did you mean 'Front open'?",
    );
    expect(resolve({ brandName: "Other" }).errors[0]).toMatchObject({ field: "brand" });
  });
});
