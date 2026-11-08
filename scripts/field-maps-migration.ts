// Writes the data migration with every channel's default field maps (listing-model/field-maps R2, Q3):
// today's register carried over, then the maps researched from each channel's own documentation, each
// with its source, date and reason. Run once; the migration, not this script, is what deploys.
//   npx tsx scripts/field-maps-migration.ts > prisma/migrations/<stamp>_default_field_maps/migration.sql
import { readFileSync } from "node:fs";

import { FACTS, FACT_DECLARATIONS } from "@server/listing/listing-facts";

const ON = "2026-11-08";
const q = (s: string | null | undefined) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

// ── Sources, as each channel publishes its requirements ─────────────────────────────────────────────
const SRC = {
  amazon: "Amazon Product Type Definitions API, amazon.in, HANDBAG schema read 2026-11-08 (tests/fixtures/amazon/HANDBAG.schema.json); other types read daily into the channel catalogue",
  flipkart: "Flipkart seller listing templates exported 2026-10-14 (listing-node-templates/flipkart)",
  meesho: "Meesho catalogue upload templates exported 2026-10-14 (listing-node-templates/meesho)",
  google: "Google Merchant Center product data specification (support.google.com/merchants/answer/7052112), read 2026-11-07",
  meta: "Meta catalog product fields (developers.facebook.com/docs/marketing-api/catalog/reference), read 2026-11-07",
} as const;
type Channel = keyof typeof SRC;

interface Row {
  channel: Channel;
  channelType: string;
  fieldPath: string;
  bbType?: string;
  source: "attribute" | "rule" | "core" | "shop" | "constant" | "developer";
  attributeKey?: string;
  ruleKey?: string;
  coreKey?: string;
  constant?: string;
  unitTarget?: string;
  reason: string;
  values?: Record<string, string>;
}

const rows: Row[] = [];
const add = (r: Row) => rows.push(r);
const attr = (channel: Channel, channelType: string, fieldPath: string, attributeKey: string, reason: string, more: Partial<Row> = {}) =>
  add({ channel, channelType, fieldPath, source: "attribute", attributeKey, reason, ...more });
const rule = (channel: Channel, channelType: string, fieldPath: string, ruleKey: string, reason: string) =>
  add({ channel, channelType, fieldPath, source: "rule", ruleKey, reason });
const core = (channel: Channel, channelType: string, fieldPath: string, coreKey: string, reason: string, more: Partial<Row> = {}) =>
  add({ channel, channelType, fieldPath, source: "core", coreKey, reason, ...more });
const fixed = (channel: Channel, channelType: string, fieldPath: string, constant: string, reason: string, attributeKey?: string) =>
  add({ channel, channelType, fieldPath, source: "constant", constant, attributeKey, reason });
const developer = (channel: Channel, channelType: string, fieldPath: string, reason: string) =>
  add({ channel, channelType, fieldPath, source: "developer", reason });

// ── Amazon ───────────────────────────────────────────────────────────────────────────────────────────
// Every type a BB type publishes to. A map for a field a type does not have is skipped when its schema is
// held (listing-builder), so the shared ones are written once per type.
const AMAZON_TYPES: Record<string, string> = {
  APPAREL: "Apparel", APPAREL_HEAD_NECK_COVERING: "Hijab", BACKPACK: "Backpack", CARRIER_BAG_CASE: "Carrier Bag",
  COIN_PURSE_POUCH: "Pouch", COSMETIC_CASE: "Cosmetic Pouch", DRESS: "Dress", HANDBAG: "Handbag",
  HEALTH_PERSONAL_CARE: "Attar", HOME_FURNITURE_AND_DECOR: "Prayer Mat", INCENSE: "Incense", PAJAMAS: "Trouser",
  PANTS: "Trouser", PERSONAL_FRAGRANCE: "Attar", RING: "Ring", RUG: "Prayer Mat", SCARF: "Hijab", SOCKS: "Socks",
  SPORT_EQUIPMENT_BAG_CASE: "Backpack", TOTE_BAG: "Tote Bag",
};
const BAGS = new Set(["BACKPACK", "CARRIER_BAG_CASE", "COIN_PURSE_POUCH", "COSMETIC_CASE", "HANDBAG", "SPORT_EQUIPMENT_BAG_CASE", "TOTE_BAG"]);
for (const [t, itemType] of Object.entries(AMAZON_TYPES)) {
  rule("amazon", t, "department", "department_from_audience", "Amazon's department list (Womens, Mens, Girls, Boys, Unisex…) is the shop's audience answer in Amazon's words");
  rule("amazon", t, "target_gender", "gender_from_audience", "Female / Male / Unisex follow from the audience; nothing new is asked");
  rule("amazon", t, "age_range_description", "age_range_from_audience", "Adult, Kid or Baby follow from the audience (spec A2)");
  core("amazon", t, "model_name", "sku", "Amazon asks the maker's model name; a shop's own style code is its SKU (HANDOFF 2026-11-08)");
  core("amazon", t, "model_number", "sku", "As model name: the shop's style code");
  core("amazon", t, "part_number", "sku", "Amazon: often identical to the model number; the SKU (HANDOFF 2026-11-08)");
  fixed("amazon", t, "item_type_name", itemType, "Amazon's item type keyword, one per product type; a generic name answered by the shop overrides it (spec R4)", "genericName");
  fixed("amazon", t, "number_of_items", "1", "Identical items in one selling unit: one, unless the shop's pack quantity says otherwise (spec R4)", "packQuantity");
  fixed("amazon", t, "item_package_quantity", "1", "Packages in one selling unit: one, unless the pack quantity says otherwise", "packQuantity");
  core("amazon", t, "item_weight", "weight", "The product's weight, sent in grams as Amazon's unit list allows", { unitTarget: "grams" });
  for (const part of ["length", "width", "height"]) attr("amazon", t, `item_dimensions.${part}`, part, `The product's ${part}, in centimetres`, { unitTarget: "centimeters" });
  rule("amazon", t, "size_info.display_name", "size_display_from_measures", "Amazon asks how big the item is in words: its measurements, else its size label");
  attr("amazon", t, "style", "style", "Amazon's style (Contemporary, Formal…) is the style question added by the attributes subfeature (parent Q26)");
  attr("amazon", t, "capacity", "capacity", "Capacity as measured, in millilitres", { unitTarget: "milliliters" });
  if (BAGS.has(t)) {
    attr("amazon", t, "outer.material", "material", "Our Material is the bag's outer material; Amazon requires `outer` on every non-parent bag (HANDBAG allOf[7])");
    attr("amazon", t, "inner.material", "innerMaterial", "The lining material question (parent Q26); Amazon requires `inner` on bags");
    attr("amazon", t, "number_of_pockets", "pocketCount", "The pocket count question (parent Q26)");
    attr("amazon", t, "strap_type", "strapType", "Amazon's strap type (Adjustable, Cross-Body, Hand-Carry…) is how the bag is carried, not padding: the strap type question (parent Q25); was mapped to Strap");
  }
}

// ── Flipkart ─────────────────────────────────────────────────────────────────────────────────────────
const fk = JSON.parse(readFileSync("listing-node-templates/extracted/flipkart.json", "utf8")) as Record<string, { mandatory: string[]; conditional: string[]; recommended: string[]; permitted_values: Record<string, string[]> }>;
const FK_TYPE: Record<string, Record<string, string>> = {
  "abaya-burqa": { abaya: "Abaya", rida: "Abaya", burqa: "Burqa", niqab: "Naqab" },
  bag: { backpack: "Backpack", messenger: "Messenger Bag", sling: "Sling Bag", tote: "Shoulder Bag", handbag: "Shoulder Bag" },
  "hand-messenger-bag": { messenger: "Messenger Bag", handbag: "Handbag", tote: "Tote", sling: "Sling Bag" },
  "incense-stick": { incense: "Incense Sticks", bakhoor: "Incense Bricks" },
  mat: { mat: "Prayer", carpet: "Prayer" },
  ring: { ring: "Ring", "ring-set": "Ring Set", "toe-ring": "Toe Ring" },
  "sling-bag": { sling: "Sling Bag", messenger: "Messenger Bag", tote: "Tote", handbag: "Hand-held Bag" },
  sock: { ankle: "Ankle Length", crew: "Mid-Calf/Crew", "knee-high": "Knee High", "no-show": "Peds/Footie/No-Show" },
  "travel-pouch": { pouch: "Cosmetic Pouch", "toiletry-kit": "Cosmetic Pouch" },
  "travel-toiletry-kit": { "toiletry-kit": "Travel Toiletry Kit", pouch: "Travel Toiletry Kit" },
  trouser: { trouser: "Casual Trousers", palazzo: "Palazzos" },
};
const FK_DEVELOPER = ["Maximum Age - Only for Kids (Month)", "Minimum Age - Only for Kids (Month)", "Suitable For", "With Hijab", "Diamond Clarity", "Diamond Color Grade", "Diamond Cut", "Diamond Shape", "Diamond Weight (carat)", "Pearl Type", "Features"];
for (const [t, tmpl] of Object.entries(fk)) {
  const has = new Set([...tmpl.mandatory, ...tmpl.conditional, ...tmpl.recommended, ...Object.keys(tmpl.permitted_values)]);
  const on = (f: string, fn: () => void) => { if (has.has(f)) fn(); };
  on("Type", () => core("flipkart", t, "Type", "kind", "Flipkart's Type is the product's kind within its type, paired per node", { values: FK_TYPE[t] ?? {} }));
  on("Brand Color", () => attr("flipkart", t, "Brand Color", "colour", "Flipkart's brand colour is the colour as the shop names it"));
  on("Size", () => rule("flipkart", t, "Size", "size_label", "The size label, else Free Size"));
  on("Brand Size", () => rule("flipkart", t, "Brand Size", "size_label", "As Size: the shop's own size word"));
  on("Height", () => attr("flipkart", t, "Height", "height", "Height as measured, in cm", { unitTarget: "cm" }));
  on("Width", () => attr("flipkart", t, "Width", "width", "Width as measured, in cm", { unitTarget: "cm" }));
  on("External Height (cm)", () => attr("flipkart", t, "External Height (cm)", "height", "A bag's height", { unitTarget: "cm" }));
  on("External Width (cm)", () => attr("flipkart", t, "External Width (cm)", "length", "A bag's width across is our length (length × width × height, front to depth)", { unitTarget: "cm" }));
  on("External Depth (inch)", () => attr("flipkart", t, "External Depth (inch)", "width", "A bag's depth is our width", { unitTarget: "inch" }));
  on("Bag Capacity", () => attr("flipkart", t, "Bag Capacity", "capacity", "Capacity in litres", { unitTarget: "l" }));
  on("Silver Weight (g)", () => attr("flipkart", t, "Silver Weight (g)", "metalWeight", "The metal weight question (parent Q26), in grams", { unitTarget: "g" }));
  on("Quantity", () => attr("flipkart", t, "Quantity", "packQuantity", "How many in the pack"));
  on("Set of", () => attr("flipkart", t, "Set of", "packQuantity", "How many in the set"));
  for (const f of FK_DEVELOPER) on(f, () => developer("flipkart", t, f, "No question of ours answers this; raised for a developer (spec R1)"));
}

// ── Meesho ───────────────────────────────────────────────────────────────────────────────────────────
const me = JSON.parse(readFileSync("listing-node-templates/extracted/meesho.json", "utf8")) as Record<string, { fields: Array<{ label: string }>; permitted_values: Record<string, string[]> }>;
const ME_ATTR: Record<string, [string, string]> = {
  Color: ["colour", "Colour"], "Primary Color": ["colour", "The main colour"], Occasion: ["occasion", "Occasion"],
  Fabric: ["material", "Meesho asks cloth Fabric; one question (listing-facts MATERIAL)"], Material: ["material", "Material"],
  Pattern: ["pattern", "Pattern"], "Print or Pattern Type": ["pattern", "Pattern"], "Print Or Pattern Type": ["pattern", "Pattern"],
  "Sleeve Styling": ["sleeveStyling", "Sleeve styling"], "Sleeve Length": ["sleeveLength", "Sleeve length"], "Stitch Type": ["stitchType", "Stitch type"],
  Shape: ["shape", "Shape"], "Waist Rise": ["waistRise", "Waist rise"], "Waist closure": ["waistClosure", "Waist closure"], "Fit/ Shape": ["fit", "Fit"],
  "Ideal For": ["audience", "Who it is for"], Plating: ["plating", "Plating"], "Base Metal": ["baseMaterial", "Base metal"], "Stone Type": ["gemstone", "Stone"],
  Certification: ["certification", "Certification"], "No. of Compartments": ["compartments", "Compartments"], "Compartment Closure": ["closure", "Closure"],
  "Water resistant": ["waterResistant", "Water resistance"], "Shoulder Strap": ["strap", "Strap"], "Included Components": ["contents", "What is in the box"],
  "Sales Package Include": ["contents", "What is in the box"], "Shelf life (Best Before)": ["shelfLifeMonths", "Shelf life in months"],
};
const ME_MEASURE: Record<string, [string, string?]> = {
  "Length Size": ["length", "in"], "Width Size": ["width", "in"], "Height Size": ["height", "in"], "Bust Size": ["bust", "in"], "Waist Size": ["waist", "in"],
  "Product Length": ["length"], "Product Width": ["width"], "Product Height": ["height"], "Product Diameter": ["diameter"], Capacity: ["capacity"],
};
const ME_DEVELOPER = ["Handles", "Laptop Capacity", "Back", "Eyepiece Fabric", "Warranty", "Domestic Warranty", "Package", "Number Of Contents In Sales Package", "Flavour", "Sling Material Type", "Secondary Color", "Sizing", "Ornamentation"];
for (const [t, tmpl] of Object.entries(me)) {
  const has = new Set(tmpl.fields.map((f) => f.label));
  const on = (f: string, fn: () => void) => { if (has.has(f)) fn(); };
  const generic = genericNameFor(t, tmpl.permitted_values["Generic Name"] ?? []);
  on("Generic Name", () => fixed("meesho", t, "Generic Name", generic, "Meesho's generic name for this category; a generic name the shop gives overrides it", "genericName"));
  on("Net Weight (gms)", () => core("meesho", t, "Net Weight (gms)", "weight", "The product's weight, in grams", { unitTarget: "g" }));
  on("Product Weight", () => core("meesho", t, "Product Weight", "weight", "The product's weight"));
  on("Variation", () => rule("meesho", t, "Variation", "size_label", "Meesho's variation is the size; Free Size when unsized"));
  on("Net Quantity (N)", () => fixed("meesho", t, "Net Quantity (N)", "1", "One per listing unless the pack quantity says otherwise", "packQuantity"));
  on("Trends", () => fixed("meesho", t, "Trends", "Not Applicable", "Meesho permits Not Applicable; a trend is not a fact the shop states"));
  on("Trend", () => fixed("meesho", t, "Trend", "Not Applicable", "As Trends"));
  on("Type", () => core("meesho", t, "Type", "kind", "Meesho's type is the product's kind, paired by its words", { values: t === "Rings" ? { ring: "Finger Ring" } : {} }));
  for (const [f, [key, why]] of Object.entries(ME_ATTR)) on(f, () => attr("meesho", t, f, key, why));
  for (const [f, [key, unit]] of Object.entries(ME_MEASURE)) on(f, () => attr("meesho", t, f, key, `Our ${key}${unit ? `, in ${unit}, the nearest size on Meesho's list` : ", in the unit Meesho lists"}`, unit ? { unitTarget: unit } : {}));
  on("Silver Weight", () => attr("meesho", t, "Silver Weight", "metalWeight", "The metal weight question (parent Q26)"));
  on("Size", () => rule("meesho", t, "Size", "size_label", "The size label, else Free Size; a list without Free Size shows the shop a gap"));
  on("Diameter", () => attr("meesho", t, "Diameter", "diameter", "A ring's inner diameter, in millimetres, the nearest on Meesho's list", { unitTarget: "mm" }));
  on("Length", () => t === "Socks"
    ? core("meesho", t, "Length", "kind", "A sock's length is its kind", { values: { ankle: "Ankle length", crew: "Crew Length", "knee-high": "Knee length", "no-show": "No show" } })
    : developer("meesho", t, "Length", "Cropped or full length is not a question we ask yet; raised for a developer (spec R1)"));
  for (const f of ME_DEVELOPER) on(f, () => developer("meesho", t, f, "No question of ours answers this; raised for a developer (spec R1)"));
}
/** The category's own entry on Meesho's Generic Name list: its name as Meesho writes it, else "Others". */
function genericNameFor(category: string, list: readonly string[]): string {
  const norm = (v: string) => v.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
  const name = norm(category.replace(/---/g, " & ").replace(/-/g, " "));
  return list.find((v) => norm(v) === name) ?? list.find((v) => norm(v).replace(/s\b/g, "") === name.replace(/s\b/g, "")) ?? "Others";
}

const MEESHO_CATEGORY: Array<[string, string | null, string, string | null]> = [
  // [our type, kind, Meesho category, note when it is only the closest Meesho has (field-maps Q19)]
  ["islamic-wear", "abaya", "Abayas", null], ["islamic-wear", "burqa", "Burqa", null], ["islamic-wear", "niqab", "Niqab", null],
  ["islamic-wear", "hijab", "Hijab", null], ["islamic-wear", "rida", "Other-Islamic-Wear", "Meesho has no rida category; listed under Other Islamic Wear"],
  ["islamic-wear", "other", "Other-Islamic-Wear", null], ["fragrance", "attar", "Attar", null],
  ["bag", "backpack", "Backpacks", null], ["bag", "handbag", "Handbags", null], ["bag", "tote", "Handbags", "Meesho has no tote category; listed under Handbags"],
  ["bag", "sling", "Cross-Body-Bags---Sling-Bags", null], ["bag", "messenger", "Cross-Body-Bags---Sling-Bags", null],
  ["travel-pouch", null, "Pouches", null], ["prayer-mat", "mat", "Floormats---Dhurries", "Meesho has no prayer mat category; listed under Floormats & Dhurries"],
  ["prayer-mat", "carpet", "Medium-Weight-Carpets", "Meesho has no prayer carpet category; listed under Medium Weight Carpets"],
  ["jewellery", "ring", "Rings", null], ["jewellery", "ring-set", "Rings", "Meesho has no ring set category; listed under Rings"],
  ["jewellery", "toe-ring", "Rings", "Meesho has no toe ring category or type; listed under Rings"],
  ["socks", null, "Socks", null], ["trousers", "trouser", "Trousers---Pants", null], ["trousers", "palazzo", "Palazzos", null],
  ["trousers", "salwar", "Trousers---Pants", "Meesho has no salwar category; listed under Trousers & Pants"],
  // Combos sell on this store only (channel-registry, 2026-10-04): no Meesho category for them.
];

// ── Google and Meta ──────────────────────────────────────────────────────────────────────────────────
const SHOPFRONT_TYPES = ["100", "108", "1604", "200", "204", "209", "3032", "3686", "479", "543673", "97"];
const APPAREL = new Set(["1604", "200", "204", "209", "3032", "543673"]);
for (const channel of ["google", "meta"] as const) {
  for (const t of SHOPFRONT_TYPES) {
    rule(channel, t, "age_group", "age_group_from_audience", "Age group follows from the audience (channel-catalogue Q8): sent for filters and matching");
    if (APPAREL.has(t)) rule(channel, t, "size", "size_label", "The size label, else Free Size (channel-catalogue Q8)");
    if (channel === "google") core(channel, t, "product_weight", "weight", "Weight helps Google match shipping and listings; in grams", { unitTarget: "g" });
    if (channel === "meta") core(channel, t, "shipping_weight", "weight", "Meta's shipping weight, in grams", { unitTarget: "g" });
  }
}

// Every pair names a word the channel's own list holds, or the generator stops (review of unit 2).
const listsOf: Record<string, (t: string, f: string) => readonly string[] | undefined> = {
  flipkart: (t, f) => fk[t]?.permitted_values[f], meesho: (t, f) => me[t]?.permitted_values[f],
};
for (const r of rows) {
  const list = listsOf[r.channel]?.(r.channelType, r.fieldPath);
  for (const v of Object.values(r.values ?? {})) if (list && !list.includes(v)) throw new Error(`${r.channel} ${r.channelType} ${r.fieldPath}: "${v}" is not on the channel's list`);
}

// ── SQL ──────────────────────────────────────────────────────────────────────────────────────────────
const id = (r: Row) => `'fm_' || md5(${q(`${r.channel}:${r.channelType}:${r.fieldPath}:${r.bbType ?? ""}`)})`;
const factLists = FACTS.flatMap((f) => (FACT_DECLARATIONS[f].list ? [`(${q(f)}, ${q(FACT_DECLARATIONS[f].list!)})`] : []));

const carriedPairs = [
  "-- 4. Today's answer words, onto each carried map still reading the fact they were recorded for (a researched",
  "-- row that changed the source or the question takes none).",
  `INSERT INTO "FieldValueMap" ("id", "fieldMapId", "optionKey", "channelValue")`,
  `SELECT 'fv_' || md5(f."id" || ':' || v."valueKey"), f."id", v."valueKey", v."theirValue"`,
  `FROM "FieldMap" f`,
  `JOIN "ChannelAttributeMap" m ON m."channel" = f."channel" AND m."theirCategory" = f."channelType" AND m."theirAttribute" = f."fieldPath" AND m."fact" = f."attributeKey"`,
  `JOIN (VALUES ${factLists.join(", ")}) AS l(fact, list) ON l.fact = f."attributeKey"`,
  `JOIN "ChannelValueMap" v ON v."channel" = f."channel" AND v."list" = l.list`,
  `WHERE f."source" = 'attribute' AND f."bbType" = ''`,
  `ON CONFLICT ("fieldMapId", "optionKey") DO NOTHING;`,
  "",
];
const out: string[] = [
  "-- listing-model/field-maps unit 2 (R2, Q3): every channel's default field maps. Generated by",
  "-- scripts/field-maps-migration.ts. Reference data (CLAUDE.md invariant 7): inserts, and updates only of",
  "-- the rows researched here; nothing dropped. The old register stays until retire-old-paths.",
  "",
  "-- 1. Today's register carried over: each mapped fact and each fill (their answer words in step 4).",
  `INSERT INTO "FieldMap" ("id", "channel", "channelType", "fieldPath", "bbType", "source", "attributeKey", "checkedSource", "checkedOn", "reason", "updatedAt")`,
  `SELECT 'fm_' || md5(m."channel" || ':' || m."theirCategory" || ':' || m."theirAttribute" || ':'), m."channel", m."theirCategory", m."theirAttribute", '', 'attribute', m."fact",`,
  `       COALESCE(m."checkedSource", 'channel register'), m."checkedOn", 'Carried over from the channel register', now()`,
  `FROM "ChannelAttributeMap" m WHERE m."theirCategory" <> ''`,
  `ON CONFLICT ("channel", "channelType", "fieldPath", "bbType") DO NOTHING;`,
  "",
  `INSERT INTO "FieldMap" ("id", "channel", "channelType", "fieldPath", "bbType", "source", "coreKey", "constant", "checkedSource", "checkedOn", "reason", "updatedAt")`,
  `SELECT 'fm_' || md5(a."channel" || ':' || a."theirCategory" || ':' || a."theirAttribute" || ':'), a."channel", a."theirCategory", a."theirAttribute", '',`,
  `       CASE WHEN a."constant" IS NOT NULL THEN 'constant' ELSE 'core' END, CASE WHEN a."constant" IS NULL THEN a."source" END, a."constant",`,
  `       COALESCE(a."checkedSource", 'channel register'), a."checkedOn", 'Carried over from a setup request', now()`,
  `FROM "ChannelAttributeFill" a`,
  `ON CONFLICT ("channel", "channelType", "fieldPath", "bbType") DO NOTHING;`,
  "",
  "-- 2. Researched maps: each from the channel's own documentation. A researched row replaces a carried one.",
  `INSERT INTO "FieldMap" ("id", "channel", "channelType", "fieldPath", "bbType", "source", "attributeKey", "ruleKey", "coreKey", "constant", "unitTarget", "checkedSource", "checkedOn", "reason", "updatedAt") VALUES`,
  rows.map((r) => `  (${id(r)}, ${q(r.channel)}, ${q(r.channelType)}, ${q(r.fieldPath)}, ${q(r.bbType ?? "")}, ${q(r.source)}, ${q(r.attributeKey)}, ${q(r.ruleKey)}, ${q(r.coreKey)}, ${q(r.constant)}, ${q(r.unitTarget)}, ${q(SRC[r.channel])}, DATE ${q(ON)}, ${q(r.reason)}, now())`).join(",\n"),
  `ON CONFLICT ("channel", "channelType", "fieldPath", "bbType") DO UPDATE SET`,
  `  "source" = EXCLUDED."source", "attributeKey" = EXCLUDED."attributeKey", "ruleKey" = EXCLUDED."ruleKey", "coreKey" = EXCLUDED."coreKey",`,
  `  "constant" = EXCLUDED."constant", "unitTarget" = EXCLUDED."unitTarget", "checkedSource" = EXCLUDED."checkedSource",`,
  `  "checkedOn" = EXCLUDED."checkedOn", "reason" = EXCLUDED."reason", "updatedAt" = now();`,
  "",
];
const pairs = rows.flatMap((r) => Object.entries(r.values ?? {}).map(([k, v]) => `  ('fv_' || md5(${q(`${r.channel}:${r.channelType}:${r.fieldPath}:${r.bbType ?? ""}:${k}`)}), (SELECT "id" FROM "FieldMap" WHERE "channel" = ${q(r.channel)} AND "channelType" = ${q(r.channelType)} AND "fieldPath" = ${q(r.fieldPath)} AND "bbType" = ${q(r.bbType ?? "")}), ${q(k)}, ${q(v)})`));
if (pairs.length > 0) {
  out.push(`INSERT INTO "FieldValueMap" ("id", "fieldMapId", "optionKey", "channelValue") VALUES`, pairs.join(",\n"), `ON CONFLICT ("fieldMapId", "optionKey") DO UPDATE SET "channelValue" = EXCLUDED."channelValue";`, "");
}
out.push(
  "-- 3. Meesho had no category maps: each of our types and kinds to the category its template exports.",
  `INSERT INTO "ChannelCategoryMap" ("id", "channel", "productType", "kind", "theirCategory", "theirLabel", "fit", "note", "checkedOn", "checkedSource", "publishes", "notSold", "updatedAt")`,
  `SELECT 'ccm_' || md5('meesho:' || c.ptype || ':' || COALESCE(c.kind, '*') || ':' || c.their), 'meesho', c.ptype, c.kind, c.their, replace(replace(c.their, '---', ' & '), '-', ' '),`,
  `       (CASE WHEN c.note IS NULL THEN 'EXACT' ELSE 'NEAREST' END)::"ChannelMapFit", c.note, DATE ${q(ON)}, ${q(SRC.meesho)}, true, false, now()`,
  `FROM (VALUES ${MEESHO_CATEGORY.map(([p, k, c, n]) => `(${q(p)}, ${q(k)}, ${q(c)}, ${q(n)})`).join(", ")}) AS c(ptype, kind, their, note)`,
  `WHERE EXISTS (SELECT 1 FROM "ProductType" t WHERE t."key" = c.ptype)`,
  `ON CONFLICT DO NOTHING;`,
  "",
);
out.push(...carriedPairs);
process.stdout.write(out.join("\n"));
process.stderr.write(`${rows.length} researched maps, ${pairs.length} pairs, ${MEESHO_CATEGORY.length} Meesho categories\n`);
