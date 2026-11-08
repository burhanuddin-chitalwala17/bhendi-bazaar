/** The pieces the storefront cache rests on (ADR-0065): which tables a statement writes, and a round trip through JSON. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { tablesRead, tablesWritten } from "@server/shared/table-writes";
import { cachedRead, resetReadCache } from "@server/shared/read-cache";
import { decode, encode, installStorefrontCache } from "@/lib/storefront-cache";

// What Next's data cache would hand back: whatever entry the test stored, however old.
const store = vi.hoisted(() => ({ entry: null as string | null }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => Promise<string>) => async (...a: unknown[]) => (store.entry ??= await fn(...a)),
  revalidateTag: () => {},
}));
vi.mock("next/server", () => ({ after: () => {} }));

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

  it("names ProductValue for the functions that write a product's answers (dynamic-form Q16, review B3)", () => {
    expect([...tablesWritten("SELECT bb_write_answers($1, $2::jsonb, $3::jsonb, $4)")]).toEqual(["ProductValue"]);
    expect([...tablesWritten("SELECT bb_write_inherited(p.id) FROM \"Product\" p WHERE p.\"brandId\" = $1")]).toEqual(["ProductValue"]);
    expect([...tablesWritten("SELECT bb_rederive_answers(id) FROM unnest($1::text[]) AS id")]).toEqual(["ProductValue"]);
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

describe("the installed cache", () => {
  afterEach(() => {
    resetReadCache();
    store.entry = null;
    vi.useRealTimers();
  });

  const options = { tables: ["Product"], seconds: 300 };

  it("serves a fresh entry without reading", async () => {
    installStorefrontCache();
    let reads = 0;
    const read = async () => ++reads;
    expect(await cachedRead("k", [], options, read)).toBe(1);
    expect(await cachedRead("k", [], options, read)).toBe(1);
    expect(reads).toBe(1);
  });

  it("reads live rather than serve an entry older than its seconds, which Next alone would serve", async () => {
    installStorefrontCache();
    vi.useFakeTimers({ now: new Date("2026-11-04T10:00:00Z") });
    let reads = 0;
    const read = async () => ++reads;
    await cachedRead("k", [], options, read);
    vi.setSystemTime(new Date("2026-11-04T10:05:01Z"));
    expect(await cachedRead("k", [], options, read)).toBe(2);
  });

  it("refuses a read declaring a table no write would clear", async () => {
    await expect(cachedRead("k", [], { tables: ["Cart"], seconds: 60 }, async () => 1)).rejects.toThrow(/CACHED_TABLES/);
  });
});
