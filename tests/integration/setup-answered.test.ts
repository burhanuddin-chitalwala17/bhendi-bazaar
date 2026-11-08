/**
 * A marketplace field a field map fills is answered (owner, 2026-11-08): the request page asked a developer
 * for Amazon's department, capacity, dimensions and inner/outer material on HANDBAG though field maps
 * filled every one, because it read only the old register. A map names a path; its first part is the field.
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("what a marketplace type already answers (local db)", () => {
  const type = `T${Date.now().toString(36).toUpperCase()}`;
  let prisma: typeof import("@server/shared/prisma").prisma;

  afterAll(async () => {
    if (prisma) await prisma.fieldMap.deleteMany({ where: { channel: "amazon", channelType: type } });
  });

  it("counts a field map, by the first part of its path, as an answered field", async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    const { channelSetupService } = await import("@server/listing/channel-setup.service");
    const base = { channel: "amazon", channelType: type, bbType: "", checkedSource: "test", checkedOn: new Date(), reason: "test" };
    await prisma.fieldMap.createMany({ data: [
      { ...base, id: `${type}-1`, fieldPath: "inner.material", source: "attribute", attributeKey: "innerMaterial" },
      { ...base, id: `${type}-2`, fieldPath: "item_dimensions.length", source: "attribute", attributeKey: "length" },
      { ...base, id: `${type}-3`, fieldPath: "department", source: "rule", ruleKey: "department_from_audience" },
    ] });
    const answered = await channelSetupService.answered("amazon", type);
    expect([...answered].sort()).toEqual(["department", "inner", "item_dimensions"]);
  });
});
