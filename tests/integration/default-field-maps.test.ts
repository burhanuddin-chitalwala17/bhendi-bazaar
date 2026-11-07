/**
 * listing-model/field-maps unit 2: the default maps as migrated. Every required field of Amazon's real
 * HANDBAG schema has a source (spec A1); every map names a rule, product column, unit and question that
 * exist (D2); Flipkart, Meesho, Google and Meta leave no required field without a map (R1).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

import { amazonCatalogueFields } from "@server/channels/providers/amazon/amazon.publish";
import { CORE_KEYS, FIELD_SOURCES, PLANNED_ATTRIBUTES, SHOP_KEYS, fieldsOf } from "@server/listing/field-map.types";
import { RULE_KEYS } from "@server/listing/field-rules";
import { FACTS, MEASURES } from "@server/listing/listing-facts";
import { isKnownUnit } from "@server/listing/units";
import { isDisposableDb } from "../helpers/test-db";


describe.skipIf(!isDisposableDb)("default field maps (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
  });

  it("every required field of Amazon HANDBAG has a source, or is flagged for a developer (spec A1)", async () => {
    const raw = JSON.parse(readFileSync("tests/fixtures/amazon/HANDBAG.schema.json", "utf8"));
    const required = amazonCatalogueFields(raw.schema ?? raw).filter((f) => f.requirement === "required" && !f.adapterFills).map((f) => f.key);
    const maps = await prisma.fieldMap.findMany({ where: { channel: "amazon", channelType: "HANDBAG" }, select: { fieldPath: true } });
    const covered = new Set(maps.flatMap((m) => fieldsOf(m.fieldPath)));
    expect(required.length).toBeGreaterThan(10);
    expect(required.filter((k) => !covered.has(k))).toEqual([]);
  });

  it("names only rules, columns, units and questions that exist, and says where it was checked (D2, R2)", async () => {
    const maps = await prisma.fieldMap.findMany({ select: { id: true, source: true, ruleKey: true, coreKey: true, shopKey: true, attributeKey: true, unitTarget: true, checkedSource: true, reason: true } });
    expect(maps.length).toBeGreaterThan(500);
    const questions = new Set<string>([...FACTS, ...MEASURES, ...PLANNED_ATTRIBUTES]);
    const bad = maps.filter((m) =>
      !(FIELD_SOURCES as readonly string[]).includes(m.source) ||
      (m.ruleKey !== null && !(RULE_KEYS as readonly string[]).includes(m.ruleKey)) ||
      (m.coreKey !== null && !(CORE_KEYS as readonly string[]).includes(m.coreKey)) ||
      (m.shopKey !== null && !(SHOP_KEYS as readonly string[]).includes(m.shopKey)) ||
      (m.attributeKey !== null && !questions.has(m.attributeKey)) ||
      (m.unitTarget !== null && !isKnownUnit(m.unitTarget)) ||
      !m.checkedSource || !m.reason);
    expect(bad).toEqual([]);
  });

  it("leaves no required field of Flipkart, Meesho, Google or Meta without a map (R1)", async () => {
    const fields = await prisma.channelField.findMany({
      where: { requirement: "required", adapterFills: false, goneAt: null, channelType: { channel: { in: ["flipkart", "meesho", "google", "meta"] }, source: { not: "test" } } },
      select: { key: true, channelType: { select: { channel: true, key: true } } },
    });
    const maps = await prisma.fieldMap.findMany({ where: { channel: { in: ["flipkart", "meesho", "google", "meta"] } }, select: { channel: true, channelType: true, fieldPath: true } });
    const covered = new Set(maps.flatMap((m) => fieldsOf(m.fieldPath).map((f) => `${m.channel}:${m.channelType}:${f}`)));
    expect(fields.length).toBeGreaterThan(100);
    expect(fields.map((f) => `${f.channelType.channel}:${f.channelType.key}:${f.key}`).filter((k) => !covered.has(k))).toEqual([]);
  });
});
