/**
 * listing-model/channel-catalogue against a real schema: a type stored from the channel's own
 * definition drives readiness (A1), the adapter's fields are never asked (A2), a field the channel
 * drops is marked gone and a required one it adds is recorded as a change (D2, D6).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("channel catalogue (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let catalogue: typeof import("@server/listing/channel-catalogue.service").channelCatalogueService;
  let readiness: typeof import("@server/listing/channel-readiness.service").channelReadinessService;
  let maps: typeof import("@server/listing/channel-map.repository").channelMapRepository;

  const stamp = `cc${Date.now().toString(36)}`;
  const type = `${stamp}-bag`;
  const theirType = `${stamp.toUpperCase()}_TOTE`;
  let orgId: string;
  let amazonWas: { enabled: boolean } | null;

  const field = (key: string, label: string, requirement: "required" | "optional", adapterFills = false) =>
    ({ key, label, requirement, kind: "text" as const, allowedValues: null, allowedUnits: null, adapterFills });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelCatalogueService: catalogue } = await import("@server/listing/channel-catalogue.service"));
    ({ channelReadinessService: readiness } = await import("@server/listing/channel-readiness.service"));
    ({ channelMapRepository: maps } = await import("@server/listing/channel-map.repository"));
    ({ orgId } = await ensureFixtures());
    await prisma.productType.create({ data: { key: type, label: "Test bag", facts: ["colour"], measures: [], variantAxis: [], kinds: [], factLabels: {}, labelFrom: [] } });
    await maps.setCategory({ channel: "amazon", productType: type, kind: null, theirCategory: theirType, fit: "EXACT", checkedOn: new Date() });
    await maps.setAttribute({ channel: "amazon", theirCategory: theirType, fact: "colour", theirAttribute: "color", required: true, checkedOn: new Date() });
    amazonWas = await prisma.orgChannel.findUnique({ where: { orgId_channel: { orgId, channel: "amazon" } }, select: { enabled: true } });
    await prisma.orgChannel.upsert({ where: { orgId_channel: { orgId, channel: "amazon" } }, create: { orgId, channel: "amazon", enabled: true }, update: { enabled: true } });
  });

  afterAll(async () => {
    // The shop is shared with every other suite: leave Amazon as it was found.
    if (amazonWas) await prisma.orgChannel.update({ where: { orgId_channel: { orgId, channel: "amazon" } }, data: amazonWas });
    else await prisma.orgChannel.deleteMany({ where: { orgId, channel: "amazon" } });
    await prisma.channelType.deleteMany({ where: { key: theirType } });
    await prisma.channelAttributeMap.deleteMany({ where: { theirCategory: theirType } });
    await prisma.channelCategoryMap.deleteMany({ where: { productType: type } });
    await prisma.productType.deleteMany({ where: { key: type } });
  });

  const READ_ON = new Date("2026-11-01T06:00:00.000Z");

  const amazonVerdict = async () => {
    const verdicts = await readiness.forProduct(orgId, { productType: type, kind: null, facts: { colour: { value: "black", origin: "product" } } as never });
    return verdicts.find((v) => v.channel === "amazon")!;
  };

  it("names the required fields the channel's own definition asks, before any send (A1)", async () => {
    await catalogue.store("amazon", {
      key: theirType, label: "Tote bag", schema: null, schemaVersion: null,
      fields: [field("color", "Colour", "required"), field("strap_type", "Strap Type", "required"), field("style", "Style", "required"), field("brand", "Brand Name", "required", true), field("lining", "Lining", "optional")],
    }, "test", READ_ON);
    const verdict = await amazonVerdict();
    const missing = verdict.report.problems.filter((p) => p.problem === "missingField");
    expect(missing.map((p) => (p as { label: string }).label).sort()).toEqual(["Strap Type", "Style"]);
    expect(verdict.report.state).toBe("incomplete");
    // Nothing re-reads it here, as when the home brand is disconnected: the last read advises, dated (A4).
    expect(missing.every((p) => (p as { asOf: string }).asOf === READ_ON.toISOString())).toBe(true);
  });

  it("never asks a field the channel's adapter fills, nor an optional one (A2)", async () => {
    const verdict = await amazonVerdict();
    const labels = verdict.report.problems.map((p) => ("label" in p ? p.label : ""));
    expect(labels).not.toContain("Brand Name");
    expect(labels).not.toContain("Lining");
  });

  it("marks a dropped field gone and records a newly required one as a change (D2, D6)", async () => {
    const added = await catalogue.store("amazon", {
      key: theirType, label: "Tote bag", schema: null, schemaVersion: null,
      fields: [field("color", "Colour", "required"), field("strap_type", "Strap Type", "required"), field("pocket_count", "Number of Pockets", "required"), field("brand", "Brand Name", "required", true)],
    }, "test");
    expect(added).toEqual(["pocket_count"]);
    const style = await prisma.channelField.findFirstOrThrow({ where: { key: "style", channelType: { key: theirType } } });
    expect(style.goneAt).not.toBeNull();
    const changes = await catalogue.changesSince(new Date(Date.now() - 60_000));
    expect(changes.some((c) => c.typeKey === theirType)).toBe(true);
    const missing = (await amazonVerdict()).report.problems.filter((p) => p.problem === "missingField").map((p) => (p as { label: string }).label);
    expect(missing.sort()).toEqual(["Number of Pockets", "Strap Type"]);
  });

  it("loads every template and spec channel with its own required fields (A3)", async () => {
    const required = async (channel: string, key: string) =>
      (await catalogue.fieldsFor([{ channel, key }])).get(`${channel}:${key}`)?.fields
        .filter((f) => f.requirement === "required" && !f.adapterFills).map((f) => f.key) ?? [];
    expect(await required("flipkart", "bag")).toEqual(expect.arrayContaining(["Color", "Ideal For", "Type"]));
    expect((await required("meesho", "Handbags")).length).toBeGreaterThan(0);
    expect((await required("google", "3032")).sort()).toEqual(["color", "gender"]);
    expect(await required("google", "100")).toEqual([]);
    expect((await required("meta", "3032")).sort()).toEqual(["color", "gender"]);
  });
});
