/** The pieces the storefront cache rests on (ADR-0065): which tables a statement writes, and a round trip through JSON. */
import { describe, expect, it } from "vitest";
import { tablesRead, tablesWritten } from "@server/shared/table-writes";
import { decode, encode } from "@/lib/storefront-cache";

describe("tablesWritten", () => {
  it("names the table an insert, update or delete writes", () => {
    expect([...tablesWritten('INSERT INTO "public"."Product" ("id") VALUES ($1)')]).toEqual(["Product"]);
    expect([...tablesWritten('UPDATE "public"."ProductStock" SET "quantity" = $1 WHERE "id" = $2')]).toEqual(["ProductStock"]);
    expect([...tablesWritten('DELETE FROM "public"."Review" WHERE "id" = $1')]).toEqual(["Review"]);
    expect([...tablesWritten('UPDATE "ChannelConnection" c SET "ordersCursor" = v.cursor FROM (VALUES ($1)) v')]).toEqual(["ChannelConnection"]);
  });

  it("does not take a lock or an upsert's conflict clause for a write of another table", () => {
    expect([...tablesWritten('SELECT id FROM "Promotion" WHERE code = $1 FOR UPDATE')]).toEqual([]);
    expect([...tablesWritten('INSERT INTO "public"."Cart" ("id") VALUES ($1) ON CONFLICT ("id") DO UPDATE SET "updatedAt" = $2')]).toEqual(["Cart"]);
  });

  it("is empty for a read, which names its tables in tablesRead instead", () => {
    const sql = 'SELECT "t0"."id" FROM "public"."Product" AS "t0" LEFT JOIN "public"."ProductStock" AS "t1" ON true';
    expect([...tablesWritten(sql)]).toEqual([]);
    expect([...tablesRead(sql)].sort()).toEqual(["Product", "ProductStock"]);
  });
});

describe("encode / decode", () => {
  it("brings Dates and Maps back as themselves, which plain JSON would not", () => {
    const value = { at: new Date("2026-11-04T10:00:00Z"), byId: new Map([["a", 1]]), rows: [{ endsAt: new Date(0), n: null }] };
    const back = decode<typeof value>(encode(value));
    expect(back.at).toBeInstanceOf(Date);
    expect(back.at.toISOString()).toBe("2026-11-04T10:00:00.000Z");
    expect(back.byId).toBeInstanceOf(Map);
    expect(back.byId.get("a")).toBe(1);
    expect(back.rows[0].endsAt.getTime()).toBe(0);
    expect(decode(encode(null))).toBeNull();
  });
});
