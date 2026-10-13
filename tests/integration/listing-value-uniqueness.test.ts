/**
 * The permitted answers, against a real schema (listing-vocabulary/categories D3, D5).
 *
 * The rule worth a database test is the one Prisma's schema language cannot express. A unique
 * index does not constrain rows whose column is NULL, so `@@unique([list, key, orgId])` alone
 * lets two platform-provided answers share a list and a key — the exact drift the single global
 * list exists to prevent. A partial unique index in the migration closes it, and nothing in the
 * schema file shows that, so this is what keeps it honest.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("listing values (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  const stamp = `lv-${Date.now().toString(36)}`;
  const list = `colour-${stamp}`;
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    orgA = (await ensureFixtures()).orgId;
    orgB = (
      await prisma.org.create({
        data: { code: `LV-${stamp}`, handle: stamp, name: "Listing Value Org", email: `${stamp}@example.invalid` },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.listingValue.deleteMany({ where: { list } });
    await prisma.org.deleteMany({ where: { id: orgB } });
  });

  it("refuses a second platform answer with the same list and key", async () => {
    await prisma.listingValue.create({ data: { list, key: "black", label: "Black" } });
    await expect(
      prisma.listingValue.create({ data: { list, key: "black", label: "Black again" } }),
    ).rejects.toThrow(/Unique constraint/i);
  });

  it("lets a shop add its own answer under a key the platform already uses", async () => {
    const own = await prisma.listingValue.create({
      data: { list, key: "black", label: "Our black", orgId: orgA },
    });
    expect(own.orgId).toBe(orgA);
  });

  it("refuses the same shop adding that key twice", async () => {
    await expect(
      prisma.listingValue.create({ data: { list, key: "black", label: "again", orgId: orgA } }),
    ).rejects.toThrow(/Unique constraint/i);
  });

  it("does not let one shop's vocabulary widen another's", async () => {
    const other = await prisma.listingValue.create({
      data: { list, key: "black", label: "Their black", orgId: orgB },
    });
    expect(other.id).not.toBe("");
    const mine = await prisma.listingValue.findMany({ where: { list, key: "black", orgId: orgA } });
    expect(mine).toHaveLength(1);
    expect(mine[0]?.label).toBe("Our black");
  });

  it("retires an answer rather than deleting it, so a product storing its key still reads", async () => {
    const value = await prisma.listingValue.create({ data: { list, key: "rust", label: "Rust" } });
    await prisma.listingValue.update({ where: { id: value.id }, data: { retiredAt: new Date() } });
    const after = await prisma.listingValue.findUnique({ where: { id: value.id } });
    expect(after?.retiredAt).toBeInstanceOf(Date);
    expect(after?.key).toBe("rust");
  });

  it("applies to every type that asks for its list, until it names some", async () => {
    const value = await prisma.listingValue.create({ data: { list, key: "teal", label: "Teal" } });
    expect(value.productTypes).toEqual([]);
    const scoped = await prisma.listingValue.update({
      where: { id: value.id },
      data: { productTypes: ["islamic-wear", "bag"] },
    });
    expect(scoped.productTypes).toEqual(["islamic-wear", "bag"]);
  });

  it("takes a shop's answers with the shop when it goes", async () => {
    const org = await prisma.org.create({
      data: { code: `LVX-${stamp}`, handle: `${stamp}x`, name: "Doomed", email: `${stamp}x@example.invalid` },
      select: { id: true },
    });
    await prisma.listingValue.create({ data: { list, key: "ochre", label: "Ochre", orgId: org.id } });
    await prisma.org.delete({ where: { id: org.id } });
    const orphans = await prisma.listingValue.findMany({ where: { list, key: "ochre" } });
    expect(orphans).toHaveLength(0);
  });
});
