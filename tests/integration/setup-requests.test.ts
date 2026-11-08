/**
 * setup-requests against a real schema: the hazards its TRD names. Two shops at once make one ticket
 * (D3); a double Apply writes once (D8); a stale preview writes nothing (D7); the same error after Done
 * reopens it (Q12); Apply's setup is what a create then sends (D6); done is checked, not claimed (D9).
 * Amazon is a fake: its type definition is whatever a test sets.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";
import { MARKETPLACE_KIND, type FieldsPlanDTO } from "@server/requests/marketplace/marketplace.types";

const fake = vi.hoisted(() => ({
  definition: null as null | { theirCategory: string; attributes: Array<{ name: string; label: string; required: boolean; allowed: string[] }> },
  search: [] as Array<{ theirCategory: string; label: string }>,
  connected: [] as Array<{ orgId: string; channel: "amazon" }>,
}));

vi.mock("@server/channels/channel-types.service", () => ({
  TypesUnavailableError: class extends Error {},
  TYPES_UNAVAILABLE: { NOT_CONNECTED: "not_connected", UNREACHABLE: "unreachable" },
  channelTypesService: {
    definition: async () => fake.definition,
    search: async () => fake.search,
    connectedOrgs: async () => fake.connected,
  },
}));

describe.skipIf(!isDisposableDb)("setup requests (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/requests/request.service").requestService;
  let fieldMaps: typeof import("@server/listing/field-map.repository").fieldMapRepository;
  let build: typeof import("@server/listing/listing-builder");
  let maps: typeof import("@server/listing/channel-map.repository").channelMapRepository;

  const stamp = `sr-${Date.now().toString(36)}`;
  const type = `${stamp}-bag`;
  // Amazon's type names have no hyphens; Apply normalises them as the channel register does.
  const theirCategory = `${stamp.toUpperCase().replace(/-/g, "_")}_TOTE`;
  const productIds: string[] = [];
  let orgId: string;
  let otherOrgId: string;
  let categoryId: string;
  let orgAddressId: string;

  const fieldsSubject = (attributes: string[]) => ({ kind: "amazon-fields" as const, channel: "amazon" as const, theirCategory, attributes });
  const ticketOf = () => prisma.ticket.findUniqueOrThrow({ where: { key: `amazon-fields:amazon:${theirCategory}` }, include: { needs: true } });

  beforeAll(async () => {
    process.env.HOME_BRAND_ORG_ID = "home-brand-for-tests";
    ({ prisma } = await import("@server/shared/prisma"));
    ({ requestService: service } = await import("@server/requests/request.service"));
    ({ fieldMapRepository: fieldMaps } = await import("@server/listing/field-map.repository"));
    build = await import("@server/listing/listing-builder");
    ({ channelMapRepository: maps } = await import("@server/listing/channel-map.repository"));
    const fixtures = await ensureFixtures();
    ({ orgId, otherOrgId, categoryId, orgAddressId } = fixtures);
    await prisma.productType.create({ data: { key: type, label: "Test bag", facts: ["colour"], measures: [], variantAxis: [], kinds: [], factLabels: {}, labelFrom: [] } });
    await maps.setCategory({ channel: "amazon", productType: type, kind: null, theirCategory, fit: "EXACT", checkedOn: new Date() });
    for (const [n, org] of [[1, orgId], [2, otherOrgId]] as const) {
      const p = await prisma.product.create({
        data: { name: `${stamp} bag ${n}`, slug: `${stamp}-${n}`, description: "x", thumbnail: "https://example.invalid/x.webp", price: 10_000, orgId: org, categoryId, productType: type, stockLocations: org === orgId ? { create: { orgAddressId, quantity: 1 } } : undefined },
        select: { id: true },
      });
      productIds.push(p.id);
    }
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { key: { contains: theirCategory } } });
    await prisma.fieldMap.deleteMany({ where: { channelType: theirCategory } });
    await prisma.ticket.deleteMany({ where: { key: { contains: type } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await prisma.channelAttributeFill.deleteMany({ where: { theirCategory } });
    await prisma.channelAttributeMap.deleteMany({ where: { theirCategory } });
    await prisma.channelCategoryMap.deleteMany({ where: { productType: type } });
    await prisma.listingValue.deleteMany({ where: { key: { in: ["detachable-x", "fixed-x"] } } });
    await prisma.productType.deleteMany({ where: { key: type } });
  });

  it("makes one ticket when two shops hit the same fix at the same moment (D3)", async () => {
    await Promise.all([
      service.raise([{ orgId, productId: productIds[0], subject: fieldsSubject(["strap_type"]) }]),
      service.raise([{ orgId: otherOrgId, productId: productIds[1], subject: fieldsSubject(["part_number"]) }]),
    ]);
    const ticket = await ticketOf();
    expect(ticket.needs).toHaveLength(2);
    expect((ticket.subject as { attributes: string[] }).attributes).toEqual(["part_number", "strap_type"]);
  });

  it("shows the admin the setup and a count, never a shop (Q3, Q4)", async () => {
    const { rows } = await service.inbox("requirement", { search: theirCategory });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: `Amazon fields for ${theirCategory}`, shopsWaiting: 2 });
    expect(JSON.stringify(rows[0])).not.toContain(orgId);
  });

  it("refuses a stale preview and writes nothing (D7)", async () => {
    const ticket = await ticketOf();
    fake.definition = { theirCategory, attributes: [{ name: "strap_type", label: "Strap Type", required: true, allowed: ["Detachable X", "Fixed X"] }] };
    const outcome = await service.apply(ticket.id, { hash: "not-what-was-seen" });
    expect(outcome).toHaveProperty("stale");
    expect(await prisma.channelAttributeMap.count({ where: { theirCategory } })).toBe(0);
  });

  it("applies once however many taps, and a create then sends what it set up (D6, D8)", async () => {
    const ticket = await ticketOf();
    const plan = await service.plan(ticket.id);
    if ("unavailable" in plan || plan.kind !== MARKETPLACE_KIND.FIELDS) throw new Error("expected a fields plan");
    const fields = (plan as FieldsPlanDTO).fields;
    expect(fields.map((f) => [f.attribute, f.solution, f.fact ?? f.source])).toEqual([
      ["part_number", "from_product", "sku"],
      ["strap_type", "add", "strap"],
    ]);
    const results = await Promise.allSettled([service.apply(ticket.id, { hash: plan.hash }), service.apply(ticket.id, { hash: plan.hash })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await ticketOf()).status).toBe("done");

    const typeRow = await prisma.productType.findUniqueOrThrow({ where: { key: type } });
    expect(typeRow.facts).toEqual(["colour", "strap"]);
    // What a create builds from the field maps Apply wrote (listing-model/field-maps R5).
    const written = await fieldMaps.forTypes([{ channel: "amazon", channelType: theirCategory }]);
    const built = build.buildChannelListing({
      fields: [], maps: build.mapsFor(written, type), labelOf: () => null,
      product: { name: "Bag", sku: "SKU-1", description: "", brand: null, weightKg: null, barcode: null, kind: null, hsn: null, measurements: {}, sizeLabel: null, facts: { strap: { value: "detachable-x", origin: "product" } } },
    });
    const sent = Object.fromEntries(built.fields.map((f) => [f.path, f.value]));
    expect(sent).toEqual({ part_number: "SKU-1", strap_type: "Detachable X" });
  });

  it("tells the shop it is ready, in its own words (Q31)", async () => {
    const [mine] = await service.forShop(orgId, { productIds: [productIds[0]] });
    expect(mine.state).toBe("ready");
    expect(mine.title).toMatch(/^Amazon details for .+ Tote$/);
    expect(mine.names).toEqual(["Part Number", "Strap Type"]);
  });

  it("reopens when the same error comes back after Done (Q12)", async () => {
    await service.raise([{ orgId, productId: productIds[0], subject: fieldsSubject(["strap_type"]) }]);
    const ticket = await ticketOf();
    expect(ticket.status).toBe("open");
    expect(ticket.reopenedAt).not.toBeNull();
  });

  it("closes a ticket whose setup was made by hand, in one daily pass (D9)", async () => {
    const before = await ticketOf();
    expect(before.status).toBe("open");
    const resolved = await service.resolveSetUp();
    expect(resolved).toBeGreaterThanOrEqual(1);
    expect((await ticketOf()).status).toBe("done");
  });

  it("raises nothing for the shop's own fixes, and an issue for what nobody can place (D5)", async () => {
    const raised = await service.raiseFromEvents([
      { orgId, productId: productIds[0], channel: "amazon", productType: null, kind: null, theirCategory, issues: [
        { code: "1", attribute: "brand", message: "Brand", field: null, need: "brand" },
        { code: "8541", attribute: null, message: "Brand not approved", field: null, need: null },
      ] },
    ]);
    expect(raised).toBe(1);
    const issue = await prisma.ticket.findUniqueOrThrow({ where: { key: `issue:Amazon:${theirCategory}:-:8541` }, include: { needs: true } });
    expect(issue.type).toBe("issue");
    expect(issue.needs[0].productId).toBe(productIds[0]);
  });

  it("takes two errors with one code on one product as one need, in one batch (review)", async () => {
    const raised = await service.raiseFromEvents([
      { orgId, productId: productIds[0], channel: "amazon", productType: null, kind: null, theirCategory, issues: [
        { code: "5000", attribute: null, message: "First", field: null, need: null },
        { code: "5000", attribute: null, message: "Second", field: null, need: null },
      ] },
    ]);
    expect(raised).toBe(1);
  });

  it("never reopens a fixed issue from a standing complaint, only from a fresh one (Q12)", async () => {
    const key = `issue:Amazon:${theirCategory}:-:5000`;
    const { id } = await prisma.ticket.findUniqueOrThrow({ where: { key } });
    await service.markFixed(id);
    const again = [{ orgId, productId: productIds[0], channel: "amazon", productType: null, kind: null, theirCategory, issues: [{ code: "5000", attribute: null, message: "First", field: null, need: null }] }];
    await service.raiseFromEvents(again, new Date(), { reopen: false });
    expect((await prisma.ticket.findUniqueOrThrow({ where: { key } })).status).toBe("done");
    await service.raiseFromEvents(again);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { key } })).status).toBe("open");
  });

  it("lets a product taken off sale leave its tickets, and closes one nobody needs (Q13)", async () => {
    const archived = await prisma.product.create({
      data: { name: `${stamp} gone`, slug: `${stamp}-gone`, description: "x", thumbnail: "https://example.invalid/x.webp", price: 10_000, orgId, categoryId, productType: type },
      select: { id: true },
    });
    const subject = { kind: "issue", source: "Amazon", context: theirCategory, subjectName: null, code: "7777", message: "x" };
    await service.raise([{ orgId, productId: archived.id, subject }]);
    await prisma.product.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    await service.daily();
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { key: `issue:Amazon:${theirCategory}:-:7777` }, include: { needs: true } });
    expect(ticket.needs).toHaveLength(0);
    expect(ticket).toMatchObject({ status: "closed", closedReason: "not_needed" });
  });

  it("drops a product id the reporting shop does not own (Q22)", async () => {
    await service.report({ orgId, productId: productIds[1], category: "other", words: "Something odd", error: null });
    const need = await prisma.ticketNeed.findFirstOrThrow({ where: { orgId, words: "Something odd" } });
    expect(need.productId).toBe("");
    await prisma.ticket.delete({ where: { id: need.ticketId } });
  });

  it("raises a category request for a type with no Amazon type, then applies the admin's pick (Q10, Q29)", async () => {
    await prisma.channelCategoryMap.deleteMany({ where: { productType: type } });
    fake.connected = [{ orgId, channel: "amazon" }];
    await service.daily();
    fake.connected = [];
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { key: `amazon-category:amazon:${type}` } });
    fake.search = [{ theirCategory, label: "Tote" }];
    const plan = await service.plan(ticket.id);
    if ("unavailable" in plan) throw new Error("expected a plan");
    await service.apply(ticket.id, { hash: plan.hash, theirCategory });
    // The standing check never reopens what the admin just applied.
    fake.connected = [{ orgId, channel: "amazon" }];
    await service.daily();
    fake.connected = [];
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe("done");
    const row = await prisma.channelCategoryMap.findFirstOrThrow({ where: { productType: type, theirCategory } });
    expect(row.publishes).toBe(true);
  });
});
