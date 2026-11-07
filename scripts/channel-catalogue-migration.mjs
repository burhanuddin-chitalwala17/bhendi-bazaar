// Writes the data migration that loads Flipkart's, Meesho's, Google's and Meta's catalogues
// (listing-model/channel-catalogue D3). Run once; the migration, not this script, is what deploys.
//   node scripts/channel-catalogue-migration.mjs > prisma/migrations/<stamp>_channel_catalogue_templates/migration.sql
import { readFileSync } from "node:fs";

const EXTRACTED = new URL("../listing-node-templates/extracted/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, EXTRACTED), "utf8"));

const REQUIRED = "required";
const CONDITIONAL = "conditional";
const OPTIONAL = "optional";
const KIND = { CHOICE: "choice", TEXT: "text", NUMBER: "number", MEASURE: "measure" };

// The templates were exported 2026-10-14; Google's and Meta's specs were read 2026-11-07.
const TEMPLATE_READ = "2026-10-14";
const SPEC_READ = "2026-11-07";

/** A unit written in a label's brackets, as "Weight (KG)" carries one. */
const PHYSICAL_UNIT = /\((cm|CM|inch|KG|kg|gms|g|carat)\)\s*$/;

// Identity, offer and compliance plumbing the adapter fills from the product, its brand or the
// shop (D4, as Amazon's SENT_BY_CREATE): never asked of the shop.
const FLIPKART_ADAPTER = new Set([
  "Seller SKU ID", "MRP (INR)", "Your selling price (INR)", "Brand", "Main Image URL", "Stock", "HSN", "Tax Code",
  "Country Of Origin", "Manufacturer Details", "Packer Details", "Importer Details", "Fullfilment by",
  "Procurement SLA (DAY)", "Procurement type", "Shipping provider", "Listing Status", "Local handling fee (INR)",
  "National handling fee (INR)", "Zonal handling fee (INR)", "Product Data Status", "Disapproval Reason (if any)",
  "Flipkart Product Link", "Model Name", "Style Code", "Model Number",
]);
const MEESHO_ADAPTER = new Set([
  "ERROR STATUS", "ERROR MESSAGE", "Product Name", "Meesho Price", "Wrong/Defective Returns Price", "MRP", "GST %",
  "HSN ID", "Inventory", "Country of Origin", "Manufacturer Name", "Manufacturer Address", "Manufacturer Pincode",
  "Packer Name", "Packer Address", "Packer Pincode", "Importer Name", "Importer Address", "Importer Pincode",
  "Image 1 (Front)", "Image 2", "Image 3", "Image 4", "Product Description", "SKU ID", "Product ID / Style ID",
  "Group ID", "Brand", "Brand Name",
]);
// Meesho asks a measure's unit as its own column; the measure carries the unit's list instead.
const MEESHO_UNIT_OF = {
  "Product Length": "Product Dimension Unit", "Product Width": "Product Dimension Unit", "Product Height": "Product Dimension Unit",
  "Product Diameter": "Product Dimension Unit", "Product Weight": "Product Weight Unit", "Silver Weight": "Silver Weight Unit",
};
const MEESHO_UNITS = new Set(["Product Dimension Unit", "Product Weight Unit", "Silver Weight Unit", "Product Unit"]);

function field(key, requirement, { kind = KIND.TEXT, values = null, units = null, adapter = false } = {}) {
  return { key, label: key, requirement, kind, allowedValues: values?.length ? values : null, allowedUnits: units?.length ? units : null, adapterFills: adapter };
}

/** A template label's kind: a bracketed unit is a measure, a list a choice, else text. */
function templateField(label, requirement, values, adapter) {
  const unit = label.match(PHYSICAL_UNIT)?.[1];
  if (unit) return field(label, requirement, { kind: KIND.MEASURE, units: [unit], adapter });
  if (adapter) return field(label, requirement, { kind: /\(INR\)|\(DAY\)/.test(label) ? KIND.NUMBER : KIND.TEXT, adapter });
  return field(label, requirement, { kind: values?.length ? KIND.CHOICE : KIND.TEXT, values });
}

function flipkart(labels) {
  const fk = read("flipkart.json");
  return Object.entries(fk).map(([key, t]) => {
    const seen = new Map();
    const add = (label, requirement) => {
      if (seen.has(label)) return;
      // A "X - Measuring Unit" column is the unit of X: filled with X's value, never asked alone.
      if (label.endsWith(" - Measuring Unit")) return seen.set(label, field(label, requirement, { kind: KIND.CHOICE, values: t.permitted_values[label], adapter: true }));
      seen.set(label, templateField(label, requirement, t.permitted_values[label], FLIPKART_ADAPTER.has(label) || label.startsWith("Other Image URL")));
    };
    t.mandatory.forEach((l) => add(l, REQUIRED));
    t.conditional.forEach((l) => add(l, CONDITIONAL));
    t.recommended.forEach((l) => add(l, OPTIONAL));
    Object.keys(t.permitted_values).forEach((l) => add(l, OPTIONAL));
    for (const f of seen.values()) {
      const unit = seen.get(`${f.key} - Measuring Unit`);
      if (unit) { f.kind = KIND.MEASURE; f.allowedValues = null; f.allowedUnits = unit.allowedValues; }
    }
    return { key, label: labels[key] ?? key, fields: [...seen.values()] };
  });
}

function meesho() {
  const me = read("meesho.json");
  return Object.entries(me).map(([key, t]) => {
    // The export cuts each list's heading to 40 characters; a list belongs to the label it starts.
    const valuesOf = (label) => t.permitted_values[label] ?? Object.entries(t.permitted_values).find(([k]) => k.length >= 40 && label.startsWith(k))?.[1] ?? null;
    const seen = new Map();
    for (const f of t.fields) {
      if (seen.has(f.label)) continue;
      const requirement = f.required ? REQUIRED : OPTIONAL;
      if (MEESHO_UNITS.has(f.label)) { seen.set(f.label, field(f.label, requirement, { kind: KIND.CHOICE, values: valuesOf(f.label), adapter: true })); continue; }
      if (MEESHO_UNIT_OF[f.label]) { seen.set(f.label, field(f.label, requirement, { kind: KIND.MEASURE, units: valuesOf(MEESHO_UNIT_OF[f.label]) })); continue; }
      seen.set(f.label, templateField(f.label, requirement, valuesOf(f.label), MEESHO_ADAPTER.has(f.label)));
    }
    return { key, label: key.replace(/---/g, " / ").replace(/-/g, " "), fields: [...seen.values()] };
  });
}

// Google Merchant Center product data specification (support.google.com/merchants/answer/7052112),
// read 2026-11-07. India enforces only colour on Apparel & Accessories (166). Gender, age group and size
// are sent anyway because filters and matching read them (channel-catalogue Q8, migration
// 20261108090000): gender is mapped from audience, age group and size are derived by the adapter.
const GOOGLE_TYPES = {
  "100": { label: "Luggage & Bags > Backpacks" },
  "108": { label: "Luggage & Bags > Cosmetic & Toiletry Bags" },
  "1604": { label: "Apparel & Accessories > Clothing", apparel: true, clothing: true },
  "200": { label: "Apparel & Accessories > Jewelry > Rings", apparel: true },
  "204": { label: "Apparel & Accessories > Clothing > Pants", apparel: true, clothing: true },
  "209": { label: "Apparel & Accessories > Clothing > Underwear & Socks > Socks", apparel: true, clothing: true },
  "3032": { label: "Apparel & Accessories > Handbags, Wallets & Cases > Handbags", apparel: true },
  "3686": { label: "Home & Garden > Decor > Home Fragrances > Incense" },
  "479": { label: "Health & Beauty > Personal Care > Cosmetics > Perfume & Cologne" },
  "543673": { label: "Apparel & Accessories > Clothing Accessories > Scarves & Shawls > Scarves", apparel: true },
  "97": { label: "Religious & Ceremonial > Religious Items" },
};

function google() {
  const adapter = { adapter: true };
  return Object.entries(GOOGLE_TYPES).map(([key, t]) => ({
    key,
    label: t.label,
    fields: [
      field("id", REQUIRED, adapter), field("title", REQUIRED, adapter), field("description", REQUIRED, adapter),
      field("link", REQUIRED, adapter), field("image_link", REQUIRED, adapter),
      field("availability", REQUIRED, { kind: KIND.CHOICE, values: ["in_stock", "out_of_stock", "preorder", "backorder"], adapter: true }),
      field("price", REQUIRED, adapter), field("brand", REQUIRED, adapter),
      field("condition", CONDITIONAL, { kind: KIND.CHOICE, values: ["new", "refurbished", "used"], adapter: true }),
      field("gtin", OPTIONAL, adapter), field("mpn", CONDITIONAL, adapter),
      field("identifier_exists", CONDITIONAL, { kind: KIND.CHOICE, values: ["yes", "no"], adapter: true }),
      field("item_group_id", CONDITIONAL, adapter), field("additional_image_link", OPTIONAL, adapter),
      field("sale_price", OPTIONAL, adapter), field("maximum_retail_price", OPTIONAL, adapter),
      field("google_product_category", OPTIONAL, adapter), field("product_type", OPTIONAL, adapter),
      field("color", t.apparel ? REQUIRED : CONDITIONAL),
      field("gender", t.apparel ? REQUIRED : OPTIONAL, { kind: KIND.CHOICE, values: ["male", "female", "unisex"] }),
      field("age_group", t.apparel ? REQUIRED : OPTIONAL, { kind: KIND.CHOICE, values: ["newborn", "infant", "toddler", "kids", "adult"], adapter: t.apparel }),
      field("size", t.clothing ? REQUIRED : CONDITIONAL, { adapter: t.clothing }),
      field("material", CONDITIONAL), field("pattern", CONDITIONAL),
      field("is_bundle", OPTIONAL, { kind: KIND.CHOICE, values: ["yes", "no"] }), field("multipack", OPTIONAL, { kind: KIND.NUMBER }),
      field("product_weight", OPTIONAL, { kind: KIND.MEASURE, units: ["g", "kg", "oz", "lb"] }),
      field("product_length", OPTIONAL, { kind: KIND.MEASURE, units: ["cm", "in"] }),
      field("product_width", OPTIONAL, { kind: KIND.MEASURE, units: ["cm", "in"] }),
      field("product_height", OPTIONAL, { kind: KIND.MEASURE, units: ["cm", "in"] }),
      field("product_highlight", OPTIONAL),
    ],
  }));
}

// Meta catalog product fields (developers.facebook.com/docs/marketing-api/catalog/reference), read
// 2026-11-07, keyed by the same Google categories our map publishes to. Size is required for clothing
// and shoes; India adds origin, importer (when imported) and maker details for Shops.
function meta() {
  const adapter = { adapter: true };
  return Object.entries(GOOGLE_TYPES).map(([key, t]) => ({
    key,
    label: t.label,
    fields: [
      field("id", REQUIRED, adapter), field("title", REQUIRED, adapter), field("description", REQUIRED, adapter),
      field("availability", REQUIRED, { kind: KIND.CHOICE, values: ["in stock", "out of stock"], adapter: true }),
      field("condition", REQUIRED, { kind: KIND.CHOICE, values: ["new", "refurbished", "used"], adapter: true }),
      field("price", REQUIRED, adapter), field("link", REQUIRED, adapter), field("image_link", REQUIRED, adapter),
      field("brand", REQUIRED, adapter), field("google_product_category", REQUIRED, adapter),
      field("origin_country", REQUIRED, adapter), field("importer_name", CONDITIONAL, adapter),
      field("importer_address", CONDITIONAL, adapter), field("manufacturer_info", CONDITIONAL, adapter),
      field("item_group_id", CONDITIONAL, adapter), field("sale_price", OPTIONAL, adapter),
      field("gtin", OPTIONAL, adapter), field("mpn", OPTIONAL, adapter), field("additional_image_link", OPTIONAL, adapter),
      field("product_type", OPTIONAL, adapter), field("quantity_to_sell_on_facebook", OPTIONAL, { kind: KIND.NUMBER, adapter: true }),
      field("color", t.apparel ? REQUIRED : CONDITIONAL), field("size", t.clothing ? REQUIRED : CONDITIONAL, { adapter: t.clothing }),
      field("gender", t.apparel ? REQUIRED : CONDITIONAL, { kind: KIND.CHOICE, values: ["female", "male", "unisex"] }),
      field("age_group", t.apparel ? REQUIRED : CONDITIONAL, { kind: KIND.CHOICE, values: ["adult", "all ages", "teen", "kids", "toddler", "infant", "newborn"], adapter: t.apparel }),
      field("material", CONDITIONAL), field("pattern", CONDITIONAL),
      field("shipping_weight", OPTIONAL, { kind: KIND.MEASURE, units: ["g", "kg", "oz", "lb"] }),
    ],
  }));
}

const q = (s) => (s === null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const j = (v) => (v === null ? "NULL" : `${q(JSON.stringify(v))}::jsonb`);

function sql(channel, source, readAt, types) {
  const typeRows = types.map((t) => `  ('cht_' || md5(${q(`${channel}:${t.key}`)}), ${q(channel)}, ${q(t.key)}, ${q(t.label)}, ${q(source)}, TIMESTAMP ${q(readAt)}, now())`);
  const fieldRows = types.flatMap((t) => t.fields.map((f) =>
    `  ('chf_' || md5(${q(`${channel}:${t.key}:${f.key}`)}), 'cht_' || md5(${q(`${channel}:${t.key}`)}), ${q(f.key)}, ${q(f.label)}, ${q(f.requirement)}, ${q(f.kind)}, ${j(f.allowedValues)}, ${j(f.allowedUnits)}, ${f.adapterFills}, TIMESTAMP ${q(readAt)}, now())`));
  return [
    `-- ${channel}: ${types.length} types, ${fieldRows.length} fields`,
    `INSERT INTO "ChannelType" ("id", "channel", "key", "label", "source", "readAt", "updatedAt") VALUES`,
    typeRows.join(",\n") + `\nON CONFLICT ("channel", "key") DO NOTHING;`,
    "",
    `INSERT INTO "ChannelField" ("id", "channelTypeId", "key", "label", "requirement", "kind", "allowedValues", "allowedUnits", "adapterFills", "readAt", "updatedAt") VALUES`,
    fieldRows.join(",\n") + `\nON CONFLICT ("channelTypeId", "key") DO NOTHING;`,
    "",
  ].join("\n");
}

const FLIPKART_LABELS = {
  "abaya-burqa": "Abaya & Burqa", bag: "Bag", "hand-messenger-bag": "Hand & Messenger Bag", "incense-stick": "Incense Sticks",
  mat: "Mat", ring: "Ring", salwar: "Salwar", "sling-bag": "Sling Bag", sock: "Socks", "travel-pouch": "Travel Pouch",
  "travel-toiletry-kit": "Travel Toiletry Kit", trouser: "Trousers",
};

process.stdout.write([
  "-- listing-model/channel-catalogue D3: the catalogues of channels that publish no definitions API.",
  "-- Generated by scripts/channel-catalogue-migration.mjs from listing-node-templates/extracted/ (Flipkart,",
  "-- Meesho) and Google's and Meta's published product specs. Reference data: inserts only, nothing dropped.",
  "",
  sql("flipkart", `flipkart-template-${TEMPLATE_READ}`, TEMPLATE_READ, flipkart(FLIPKART_LABELS)),
  sql("meesho", `meesho-template-${TEMPLATE_READ}`, TEMPLATE_READ, meesho()),
  sql("google", `google-merchant-spec-${SPEC_READ}`, SPEC_READ, google()),
  sql("meta", `meta-catalog-spec-${SPEC_READ}`, SPEC_READ, meta()),
].join("\n"));
