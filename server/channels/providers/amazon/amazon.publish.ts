import { retryBusy, rupeesFromPaise, type ListingAttributes, type TokenSource } from "../listing-read";
import { MarketplaceAuthError, MarketplaceRequestError, MarketplaceUnavailableError, marketplaceFetch } from "../marketplace-provider";
import { amazonRequirements } from "./amazon.requirements";
import { FIELD_KIND, FIELD_REQUIREMENT, type CatalogueField, type CatalogueType, type CreateListingInput, type FieldKind, type ListingProblem, type PageMatch, type PublishAnswer, type PublishChanges, type PublishRef, type StatusAnswer, type TypeDefinition, type TypeMatch } from "../publish";
import { ISSUE_NEED, LISTING_FIELD, LISTING_FIELDS, type IssueNeed, type ListingField, type ListingIssue, type ListingRules } from "../../platform-listing.types";
import { AMAZON_IN, spApi } from "./amazon.listings";

/**
 * What Amazon lets us write on a listing and its limits (channel-listings Q5, Q12): every field,
 * title 200, five features of 500, description 2,000 characters; photos JPEG, PNG, GIF or TIFF of
 * 1000 px or more. Checked 2026-11-02 (INTEGRATIONS.md "Editing and creating a listing").
 */
export const AMAZON_LISTING_RULES: ListingRules = {
  writable: LISTING_FIELDS,
  limits: { title: 200, feature: 500, description: 2000 },
  maxPhotos: 9,
  wholeRupees: false,
  photo: { minPx: 1000, formats: ["image/jpeg", "image/png", "image/gif", "image/tiff"] },
  canCreate: true,
  editIn: "Amazon Seller Central",
  genericBrand: true,
};

/** Features and description from a stored read: Amazon's `bullet_point` and `product_description`. */
export function amazonTheirsFromRead(read: ListingAttributes): { features?: string[]; description?: string } {
  const features = read.attributes.bullet_point;
  const description = read.attributes.product_description?.[0];
  return {
    ...(features && features.length > 0 ? { features: features.slice(0, 5) } : {}),
    ...(description ? { description } : {}),
  };
}

// ── Publishing (marketplace-publish D1, D2, D6, D7) ──────────────────────────────────────────

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

const text = (value: string) => [{ value, language_tag: "en_IN", marketplace_id: AMAZON_IN }];
const plain = (value: string | boolean) => [{ value, marketplace_id: AMAZON_IN }];
const money = (paise: number) => [{ schedule: [{ value_with_tax: rupeesFromPaise(paise) }] }];
const MAX_OTHER_PHOTOS = 8;
/** What Amazon.in calls an unbranded product's brand. */
const AMAZON_GENERIC_BRAND = "Generic";

/** Which of our fields an Amazon attribute is, for pinning a complaint (D9). */
const FIELD_OF: Record<string, ListingField> = {
  item_name: LISTING_FIELD.TITLE,
  bullet_point: LISTING_FIELD.FEATURES,
  product_description: LISTING_FIELD.DESCRIPTION,
  main_product_image_locator: LISTING_FIELD.PHOTOS,
  purchasable_offer: LISTING_FIELD.PRICE,
  list_price: LISTING_FIELD.PRICE,
};
/** Attributes this provider fills from the brand or the product's MRP, so a complaint says where to fix it (Q24). */
const NEED_OF: Record<string, IssueNeed> = {
  // The brand's own name: what listing as Generic answers (setup-requests Q35); the rest are its details.
  brand: ISSUE_NEED.BRAND_NAME,
  manufacturer: ISSUE_NEED.BRAND,
  rtip_manufacturer_contact_information: ISSUE_NEED.BRAND,
  packer_contact_information: ISSUE_NEED.BRAND,
  importer_contact_information: ISSUE_NEED.BRAND,
  country_of_origin: ISSUE_NEED.BRAND,
  // The offer is sent with `maximum_retail_price` only when the product has one.
  purchasable_offer: ISSUE_NEED.MRP,
  maximum_retail_price: ISSUE_NEED.MRP,
};
const fieldOf = (attribute: string): ListingField | null =>
  FIELD_OF[attribute] ?? (attribute.startsWith("other_product_image_locator") ? LISTING_FIELD.PHOTOS : null);

/** Amazon's issues as ours: errors and warnings, its sentence cut to 300 characters and stripped of markup (Q6, D9). */
export function amazonIssues(raw: unknown): ListingIssue[] {
  return list(raw).flatMap((entry) => {
    const issue = obj(entry);
    const severity = str(issue.severity)?.toUpperCase();
    if (severity !== "ERROR" && severity !== "WARNING") return [];
    const names = list(issue.attributeNames).map(String);
    const message = (str(issue.message) ?? "Amazon found a problem with this listing.").replace(/<[^>]*>/g, "").slice(0, 300);
    return [{
      code: str(issue.code) ?? "unknown",
      message,
      severity: severity === "ERROR" ? "error" : "warning",
      field: names.map(fieldOf).find((f) => f !== null) ?? null,
      attribute: names[0] ?? null,
      need: names.map((n) => NEED_OF[n]).find((n) => n !== undefined) ?? null,
    }];
  });
}

/** One operation per changed field (D2); price and on sale share one merge of the offer, with its selectors. */
export function amazonPatches(changes: PublishChanges, now: Date): unknown[] {
  const ops: unknown[] = [];
  if (changes.title !== undefined) ops.push({ op: "replace", path: "/attributes/item_name", value: text(changes.title) });
  if (changes.features !== undefined) {
    ops.push(changes.features.length > 0
      ? { op: "replace", path: "/attributes/bullet_point", value: changes.features.map((f) => text(f)[0]) }
      : { op: "delete", path: "/attributes/bullet_point" });
  }
  if (changes.description !== undefined) ops.push({ op: "replace", path: "/attributes/product_description", value: text(changes.description) });
  if (changes.photoUrls !== undefined && changes.photoUrls.length > 0) {
    const [main, ...others] = changes.photoUrls;
    ops.push({ op: "replace", path: "/attributes/main_product_image_locator", value: [{ media_location: main, marketplace_id: AMAZON_IN }] });
    for (let i = 1; i <= MAX_OTHER_PHOTOS; i++) {
      const url = others[i - 1];
      ops.push(url
        ? { op: "replace", path: `/attributes/other_product_image_locator_${i}`, value: [{ media_location: url, marketplace_id: AMAZON_IN }] }
        : { op: "delete", path: `/attributes/other_product_image_locator_${i}` });
    }
  }
  if (changes.price !== undefined || changes.listed !== undefined) {
    // Amazon has no pause: ending the offer takes it off sale and keeps the listing (Q17).
    ops.push({
      op: "merge",
      path: "/attributes/purchasable_offer",
      value: [{
        marketplace_id: AMAZON_IN,
        currency: "INR",
        audience: "ALL",
        ...(changes.price !== undefined ? { our_price: money(changes.price) } : {}),
        ...(changes.listed !== undefined ? { end_at: changes.listed ? null : { value: now.toISOString() } } : {}),
      }],
    });
  }
  return ops;
}

const fieldsOf = (changes: PublishChanges): ListingField[] => [
  ...(changes.title !== undefined ? [LISTING_FIELD.TITLE] : []),
  ...(changes.price !== undefined ? [LISTING_FIELD.PRICE] : []),
  ...(changes.photoUrls !== undefined ? [LISTING_FIELD.PHOTOS] : []),
  ...(changes.features !== undefined ? [LISTING_FIELD.FEATURES] : []),
  ...(changes.description !== undefined ? [LISTING_FIELD.DESCRIPTION] : []),
  ...(changes.listed !== undefined ? [LISTING_FIELD.LISTED] : []),
];

const itemPath = (account: string, sku: string, query: Record<string, string> = {}) =>
  `/listings/2021-08-01/items/${encodeURIComponent(account)}/${encodeURIComponent(sku)}?${new URLSearchParams({ marketplaceIds: AMAZON_IN, ...query }).toString()}`;

const refused = (step: string): ListingIssue => ({ code: step, message: "Amazon turned this request down.", severity: "error", field: null });

/** The answer to a send: what was taken, what was refused (D2, D9). */
function answerOf(body: unknown, sent: ListingField[]): PublishAnswer {
  const result = obj(body);
  const issues = amazonIssues(result.issues);
  if (result.status === "INVALID") return { accepted: [], issues: issues.length > 0 ? issues : [refused("invalid")], decidesLater: false };
  const refusedFields = new Set(issues.filter((i) => i.severity === "error").map((i) => i.field));
  if (refusedFields.has(null)) return { accepted: [], issues, decidesLater: true };
  return { accepted: sent.filter((f) => !refusedFields.has(f)), issues, decidesLater: true };
}

async function productTypeOf(token: TokenSource, account: string, ref: PublishRef): Promise<string> {
  if (ref.marketplaceType) return ref.marketplaceType;
  const item = obj(await retryBusy(() => spApi(token, "publish type", itemPath(account, ref.sku, { includedData: "summaries" }))));
  return String(obj(list(item.summaries)[0]).productType ?? "PRODUCT");
}

/** Send only what changed, as one `patchListingsItem` (D2); a busy Amazon throws so the queue retries. */
export async function amazonPublish(token: TokenSource, account: string | null, ref: PublishRef, changes: PublishChanges): Promise<PublishAnswer> {
  if (!account) throw new MarketplaceAuthError("rejected");
  // Photos with none left to send are a refusal on Photos, never a quiet success that leaves them waiting.
  const noPhotos: ListingIssue[] = changes.photoUrls?.length === 0 ? [{ code: "no_photos", message: "None of these photos could be sent to Amazon. Replace them on the product and publish again.", severity: "error", field: LISTING_FIELD.PHOTOS }] : [];
  const sent = fieldsOf(changes).filter((f) => !(f === LISTING_FIELD.PHOTOS && noPhotos.length > 0));
  const patches = amazonPatches(changes, new Date());
  if (patches.length === 0) return { accepted: [], issues: noPhotos, decidesLater: false };
  try {
    const productType = await productTypeOf(token, account, ref);
    const body = await retryBusy(() => spApi(token, "publish patch", itemPath(account, ref.sku, { includedData: "issues" }), { method: "PATCH", body: JSON.stringify({ productType, patches }) }));
    const answer = answerOf(body, sent);
    return noPhotos.length > 0 ? { ...answer, issues: [...answer.issues, ...noPhotos], decidesLater: false } : answer;
  } catch (error) {
    if (error instanceof MarketplaceRequestError) return { accepted: [], issues: [refused("request")], decidesLater: false };
    throw error;
  }
}

/** The listing as Amazon holds it now: on sale, its complaints, what its page shows (D5, Q14). */
export async function amazonListingStatus(token: TokenSource, account: string | null, ref: PublishRef): Promise<StatusAnswer> {
  if (!account) throw new MarketplaceAuthError("rejected");
  try {
    const item = obj(await retryBusy(() => spApi(token, "publish check", itemPath(account, ref.sku, { includedData: "summaries,issues" }))));
    const summary = obj(list(item.summaries)[0]);
    const status = list(summary.status).map(String);
    return {
      found: true,
      live: status.includes("BUYABLE"),
      issues: amazonIssues(item.issues),
      showing: { title: str(summary.itemName), mainImageUrl: str(obj(summary.mainImage).link) },
    };
  } catch (error) {
    if (error instanceof MarketplaceRequestError && error.status === 404) return { found: false, live: null, issues: [], showing: { title: null, mainImageUrl: null } };
    throw error;
  }
}

/** Amazon hides a listing by enforcement; any of these means shoppers cannot find or buy it. */
const SUPPRESSING = new Set(["LISTING_SUPPRESSED", "SEARCH_SUPPRESSED", "CATALOG_ITEM_REMOVED"]);
const PROBLEM_PAGES_MAX = 50;

/**
 * Every listing with an error now (Q23): one search filtered to errors, twenty a page, so a clean
 * account costs one call a day whatever its size. Suppressed when an issue's enforcement hides it.
 */
export async function amazonListingProblems(token: TokenSource, account: string | null): Promise<ListingProblem[]> {
  if (!account) throw new MarketplaceAuthError("rejected");
  const out: ListingProblem[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < PROBLEM_PAGES_MAX; page++) {
    const query = new URLSearchParams({ marketplaceIds: AMAZON_IN, withIssueSeverity: "ERROR", includedData: "summaries,issues", pageSize: "20", ...(pageToken ? { pageToken } : {}) });
    const body = obj(await retryBusy(() => spApi(token, "listing problems", `/listings/2021-08-01/items/${encodeURIComponent(account)}?${query.toString()}`)));
    for (const entry of list(body.items)) {
      const item = obj(entry);
      const sku = str(item.sku);
      const issues = amazonIssues(item.issues).filter((i) => i.severity === "error");
      if (!sku || issues.length === 0) continue;
      const suppressed = list(item.issues).some((raw) => list(obj(obj(raw).enforcements).actions).some((a) => SUPPRESSING.has(String(obj(a).action))));
      out.push({ sku, issues, suppressed });
    }
    pageToken = str(obj(body.pagination).nextToken);
    if (!pageToken) break;
  }
  return out;
}

/** Pages already on Amazon for a product: by barcode first, then by its name (D6). */
export async function amazonFindPages(token: TokenSource, _account: string | null, query: { barcode: string | null; keywords: string }): Promise<PageMatch[]> {
  const search = async (params: Record<string, string>, matchedBy: PageMatch["matchedBy"]) => {
    const qs = new URLSearchParams({ marketplaceIds: AMAZON_IN, includedData: "summaries,images", pageSize: "5", ...params });
    const body = obj(await retryBusy(() => spApi(token, "catalog search", `/catalog/2022-04-01/items?${qs.toString()}`)));
    return list(body.items).flatMap((raw) => {
      const item = obj(raw);
      const asin = str(item.asin);
      if (!asin) return [];
      const summary = obj(list(item.summaries)[0]);
      const image = obj(list(obj(list(item.images)[0]).images)[0]);
      return [{ externalId: asin, title: str(summary.itemName) ?? asin, imageUrl: str(image.link), matchedBy }];
    });
  };
  if (query.barcode) {
    const type = query.barcode.length === 12 ? "UPC" : "EAN";
    const byBarcode = await search({ identifiers: query.barcode, identifiersType: type }, "barcode");
    if (byBarcode.length > 0) return byBarcode;
  }
  return query.keywords.trim() ? await search({ keywords: query.keywords.slice(0, 200) }, "name") : [];
}

/** The variation themes Amazon allows for a type, read from its schema (D7: themes are read, never assumed). */
/** A type's JSON schema, by way of the definition's link (D7; setup-requests D7). Null when Amazon has no such type. */
async function amazonTypeSchema(token: TokenSource, productType: string): Promise<Record<string, unknown> | null> {
  const qs = new URLSearchParams({ marketplaceIds: AMAZON_IN, requirements: "LISTING", locale: "en_IN" });
  let definition: Record<string, unknown>;
  try {
    definition = obj(await retryBusy(() => spApi(token, "type definition", `/definitions/2020-09-01/productTypes/${encodeURIComponent(productType)}?${qs.toString()}`)));
  } catch (error) {
    if (error instanceof MarketplaceRequestError && error.status === 404) return null;
    throw error;
  }
  const link = str(obj(obj(definition.schema).link).resource);
  if (!link) return null;
  const response = await marketplaceFetch(link, { method: "GET" });
  if (!response.ok) throw new MarketplaceUnavailableError(response.status);
  return obj(await response.json());
}

/** Attributes Amazon requires of every listing that a create already sends or a shop's details answer: never asked (setup-requests D6). */
const SENT_BY_CREATE = new Set([
  "item_name", "brand", "bullet_point", "product_description", "main_product_image_locator", "purchasable_offer",
  "fulfillment_availability", "condition_type", "externally_assigned_product_identifier", "supplier_declared_has_product_identifier_exemption",
  "country_of_origin", "manufacturer", "rtip_manufacturer_contact_information", "packer_contact_information", "importer_contact_information",
  "external_product_information", "supplier_declared_dg_hz_regulation", "parentage_level", "variation_theme", "child_parent_sku_relationship",
  "merchant_suggested_asin", "list_price", "maximum_retail_price", "skip_offer",
]);

/** The answers an attribute's schema allows, wherever Amazon nests the `value` enum. */
function allowedOf(property: Record<string, unknown>): string[] {
  const value = obj(obj(obj(property.items).properties).value);
  const names = list(value.enumNames).map(String);
  const values = list(value.enum).map(String);
  return names.length === values.length && names.length > 0 ? names : values;
}

/** A type's definition: its required attributes and what each allows (setup-requests D7). */
export async function amazonTypeDefinition(token: TokenSource, productType: string): Promise<TypeDefinition | null> {
  const schema = await amazonTypeSchema(token, productType);
  if (!schema) return null;
  const requirements = amazonRequirements(schema);
  const properties = obj(schema.properties);
  const attributes = Object.entries(properties).flatMap(([name, raw]) => {
    if (requirements.get(name) !== FIELD_REQUIREMENT.REQUIRED || SENT_BY_CREATE.has(name) || name.startsWith("other_product_image_locator")) return [];
    const property = obj(raw);
    return [{ name, label: str(property.title) ?? name, required: true, allowed: allowedOf(property) }];
  });
  return { theirCategory: productType, attributes };
}

/** The units a measure attribute accepts, from its `unit` enum. */
function unitsOf(property: Record<string, unknown>): string[] {
  const unit = obj(obj(obj(property.items).properties).unit);
  return list(unit.enum).map(String);
}

/** A property's kind: a measure has a unit, a choice an enum, then number, boolean, else text. */
function kindOf(property: Record<string, unknown>): FieldKind {
  const props = obj(obj(property.items).properties);
  if (props.unit) return FIELD_KIND.MEASURE;
  if (allowedOf(property).length > 0) return FIELD_KIND.CHOICE;
  const type = str(obj(props.value).type);
  if (type === "number" || type === "integer") return FIELD_KIND.NUMBER;
  if (type === "boolean") return FIELD_KIND.BOOLEAN;
  return FIELD_KIND.TEXT;
}

/**
 * A type's every field as the catalogue stores it (listing-model/channel-catalogue D2), each rule judged
 * for the listing Q3 names (`amazonRequirements`); what a create always sends is the adapter's (Q5).
 */
export function amazonCatalogueFields(schema: Record<string, unknown>): CatalogueField[] {
  const requirements = amazonRequirements(schema);
  return Object.entries(obj(schema.properties)).map(([key, raw]) => {
    const property = obj(raw);
    const allowed = allowedOf(property);
    const units = unitsOf(property);
    return {
      key,
      label: str(property.title) ?? key,
      requirement: requirements.get(key) ?? FIELD_REQUIREMENT.OPTIONAL,
      kind: kindOf(property),
      allowedValues: allowed.length > 0 ? allowed : null,
      allowedUnits: units.length > 0 ? units : null,
      adapterFills: SENT_BY_CREATE.has(key) || key.startsWith("other_product_image_locator"),
    };
  });
}

/** A type's catalogue entry, read live (channel-catalogue D2). Null when Amazon has no such type. */
export async function amazonCatalogueType(token: TokenSource, productType: string): Promise<CatalogueType | null> {
  const schema = await amazonTypeSchema(token, productType);
  if (!schema) return null;
  return { key: productType, label: str(schema.title) ?? productType, schema, schemaVersion: str(schema.$id), fields: amazonCatalogueFields(schema) };
}

/** Amazon's types matching some words, as Amazon ranks them (setup-requests Q29). */
export async function amazonSearchTypes(token: TokenSource, words: string): Promise<TypeMatch[]> {
  const qs = new URLSearchParams({ marketplaceIds: AMAZON_IN, keywords: words, locale: "en_IN" });
  const body = obj(await retryBusy(() => spApi(token, "type search", `/definitions/2020-09-01/productTypes?${qs.toString()}`)));
  return list(body.productTypes).flatMap((raw) => {
    const t = obj(raw);
    const name = str(t.name);
    return name ? [{ theirCategory: name, label: str(t.displayName) ?? name }] : [];
  });
}

export async function amazonVariationThemes(token: TokenSource, _account: string | null, productType: string): Promise<string[]> {
  const schema = await amazonTypeSchema(token, productType);
  if (!schema) return [];
  const theme = obj(obj(schema.properties).variation_theme);
  const name = obj(obj(obj(obj(theme.items).properties).name));
  return list(name.enum).map(String);
}

const barcodeType = (code: string) => (code.length === 12 ? "upc" : code.length === 14 ? "gtin" : "ean");

/** A mapped attribute as Amazon's shape: `name` or `name.part` paths from the mapping (D8). */
function mapped(attributes: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(attributes)) {
    const [name, part] = path.split(".");
    out[name] = part ? [{ [part]: text(value), marketplace_id: AMAZON_IN }] : text(value);
  }
  return out;
}

/** The whole listing a create sends: the one place a full listing goes to Amazon (D2, D6, D7, D8). */
export function amazonCreateBody(input: CreateListingInput): { productType: string; requirements: string; attributes: Record<string, unknown> } {
  const isParent = input.family?.role === "parent";
  const offer = isParent
    ? {}
    : {
        condition_type: plain("new_new"),
        purchasable_offer: [{
          marketplace_id: AMAZON_IN,
          currency: "INR",
          audience: "ALL",
          our_price: money(input.price),
          ...(input.mrpPaise ? { maximum_retail_price: money(input.mrpPaise) } : {}),
        }],
        fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: input.quantity }],
      };
  if (input.mode === "offer") {
    return {
      productType: input.marketplaceType ?? "PRODUCT",
      requirements: "LISTING_OFFER_ONLY",
      attributes: { merchant_suggested_asin: plain(input.targetExternalId ?? ""), ...offer },
    };
  }
  const [main, ...others] = input.photoUrls;
  const identity = input.barcode
    ? { externally_assigned_product_identifier: [{ type: barcodeType(input.barcode), value: input.barcode, marketplace_id: AMAZON_IN }] }
    : { supplier_declared_has_product_identifier_exemption: plain(true) };
  const c = input.compliance;
  return {
    productType: input.marketplaceType ?? "PRODUCT",
    requirements: "LISTING",
    attributes: {
      ...mapped(input.attributes),
      item_name: text(input.title),
      // Amazon's own word for an unbranded listing; never another shop's registered brand (setup-requests Q35).
      ...(input.generic ? { brand: text(AMAZON_GENERIC_BRAND) } : input.brand ? { brand: text(input.brand) } : {}),
      ...(input.features.length > 0 ? { bullet_point: input.features.map((f) => text(f)[0]) } : {}),
      ...(input.description ? { product_description: text(input.description) } : {}),
      ...(main ? { main_product_image_locator: [{ media_location: main, marketplace_id: AMAZON_IN }] } : {}),
      ...Object.fromEntries(others.slice(0, MAX_OTHER_PHOTOS).map((url, i) => [`other_product_image_locator_${i + 1}`, [{ media_location: url, marketplace_id: AMAZON_IN }]])),
      ...(isParent ? {} : identity),
      ...(c.countryOfOrigin ? { country_of_origin: plain(c.countryOfOrigin) } : {}),
      ...(c.manufacturer ? { manufacturer: text(c.manufacturer), rtip_manufacturer_contact_information: text(c.manufacturer) } : {}),
      ...(c.packer ? { packer_contact_information: text(c.packer) } : {}),
      ...(c.importer ? { importer_contact_information: text(c.importer) } : {}),
      ...(c.hsn ? { external_product_information: [{ entity: "HSN Code", value: c.hsn, marketplace_id: AMAZON_IN }] } : {}),
      supplier_declared_dg_hz_regulation: plain("not_applicable"),
      ...(input.family
        ? {
            parentage_level: plain(input.family.role),
            variation_theme: [{ name: input.family.theme }],
            ...(input.family.role === "child" ? { child_parent_sku_relationship: [{ child_relationship_type: "variation", parent_sku: input.family.parentSku, marketplace_id: AMAZON_IN }] } : {}),
          }
        : {}),
      ...offer,
    },
  };
}

/** Create a listing, or with `preview` only ask Amazon what it would say (Q9: check-only mode first). */
export async function amazonCreate(token: TokenSource, account: string | null, input: CreateListingInput, options: { preview: boolean }): Promise<PublishAnswer> {
  if (!account) throw new MarketplaceAuthError("rejected");
  const body = amazonCreateBody(input);
  const query: Record<string, string> = { requirements: body.requirements, includedData: "issues", ...(options.preview ? { mode: "VALIDATION_PREVIEW" } : {}) };
  try {
    const answer = await retryBusy(() =>
      spApi(token, options.preview ? "create preview" : "create", itemPath(account, input.sku, query), {
        method: "PUT",
        body: JSON.stringify({ productType: body.productType, requirements: body.requirements, attributes: body.attributes }),
      }),
    );
    const result = answerOf(answer, LISTING_FIELDS.slice());
    // Any error means not created; a preview's VALID only means "no known errors" (Q9).
    return result.issues.some((i) => i.severity === "error") ? { ...result, accepted: [] } : result;
  } catch (error) {
    if (error instanceof MarketplaceRequestError) return { accepted: [], issues: [refused("request")], decidesLater: false };
    throw error;
  }
}
