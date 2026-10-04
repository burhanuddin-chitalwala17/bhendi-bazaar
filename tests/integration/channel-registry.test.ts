/**
 * The registry's uniqueness, against a real schema
 * ([channel-registry](../../docs/specs/channel-registry/) D2, D3; [ADR-0045](../../docs/adr/0045-channel-mappings-are-versioned-data.md)).
 *
 * A mapping table whose key is not unique is worse than no table: two rows claiming different
 * nodes for one product type means publishing picks whichever the query returned first, and it
 * will do that silently and differently on different days. Each rule below is one `@@unique` —
 * except the one Prisma's schema language cannot say, which is the one most likely to rot.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { CHANNEL } from "@server/shared/channels";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("the channel registry (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  const stamp = `cr-${Date.now().toString(36)}`;
  const type = `type-${stamp}`;
  const list = `list-${stamp}`;
  const checkedOn = new Date("2026-10-04");
  let orgId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    orgId = (await ensureFixtures()).orgId;
  });

  afterAll(async () => {
    await Promise.all([
      prisma.channelCategoryMap.deleteMany({ where: { productType: type } }),
      prisma.channelAttributeMap.deleteMany({ where: { productType: type } }),
      prisma.channelValueMap.deleteMany({ where: { list } }),
      prisma.orgChannel.deleteMany({ where: { orgId } }),
    ]);
  });

  describe("which of their categories a type publishes to", () => {
    it("takes one mapping per channel, type and kind", async () => {
      const row = await prisma.channelCategoryMap.create({
        data: {
          channel: CHANNEL.FLIPKART,
          productType: type,
          kind: "abaya",
          theirCategory: "ethnic-wear/abaya",
          checkedOn,
        },
      });
      expect(row.fit).toBe("EXACT");
    });

    it("refuses a second mapping for the same kind", async () => {
      await expect(
        prisma.channelCategoryMap.create({
          data: {
            channel: CHANNEL.FLIPKART,
            productType: type,
            kind: "abaya",
            theirCategory: "somewhere-else",
            checkedOn,
          },
        }),
      ).rejects.toThrow(/Unique constraint/i);
    });

    it("lets another kind of the same type go somewhere else — it is a different node", async () => {
      const row = await prisma.channelCategoryMap.create({
        data: {
          channel: CHANNEL.FLIPKART,
          productType: type,
          kind: "rida",
          theirCategory: "ethnic-wear/other",
          fit: "NEAREST",
          note: "Flipkart has no rida node; the nearest is ethnic wear → other.",
          checkedOn,
        },
      });
      expect(row.fit).toBe("NEAREST");
    });

    it("lets another channel map the same kind to its own node", async () => {
      const row = await prisma.channelCategoryMap.create({
        data: {
          channel: CHANNEL.MEESHO,
          productType: type,
          kind: "abaya",
          theirCategory: "Kurtas & Abayas",
          checkedOn,
        },
      });
      expect(row.channel).toBe(CHANNEL.MEESHO);
    });

    /**
     * The rule the schema file cannot show. NULLs are distinct to a unique index, so
     * `@@unique([channel, productType, kind])` permits two rows that both mean "every kind of
     * this type" — two answers to one question. The partial index in the migration is what
     * refuses the second; break it there and this is the test that goes red.
     */
    it("refuses a second mapping covering every kind of a type", async () => {
      await prisma.channelCategoryMap.create({
        data: {
          channel: CHANNEL.GOOGLE,
          productType: type,
          kind: null,
          theirCategory: "Apparel & Accessories > Clothing",
          checkedOn,
        },
      });

      await expect(
        prisma.channelCategoryMap.create({
          data: {
            channel: CHANNEL.GOOGLE,
            productType: type,
            kind: null,
            theirCategory: "Apparel & Accessories",
            checkedOn,
          },
        }),
      ).rejects.toThrow(/Unique constraint/i);
    });

    it("still lets a kind be named beside that catch-all, to override it", async () => {
      const row = await prisma.channelCategoryMap.create({
        data: {
          channel: CHANNEL.GOOGLE,
          productType: type,
          kind: "rida",
          theirCategory: "Apparel & Accessories > Clothing > Dresses",
          checkedOn,
        },
      });
      expect(row.kind).toBe("rida");
    });
  });

  describe("what they call a fact", () => {
    it("takes one name per channel, type and fact", async () => {
      const row = await prisma.channelAttributeMap.create({
        data: {
          channel: CHANNEL.FLIPKART,
          productType: type,
          fact: "material",
          theirAttribute: "Fabric",
          required: true,
          checkedOn,
        },
      });
      expect(row.required).toBe(true);
    });

    it("refuses the same fact named twice for one type", async () => {
      await expect(
        prisma.channelAttributeMap.create({
          data: {
            channel: CHANNEL.FLIPKART,
            productType: type,
            fact: "material",
            theirAttribute: "Material",
            checkedOn,
          },
        }),
      ).rejects.toThrow(/Unique constraint/i);
    });

    // Flipkart asks cloth its `Fabric` and everything else `Material`, which is why the type is
    // part of the key rather than the fact alone.
    it("lets one channel call the same fact different things in two types", async () => {
      const row = await prisma.channelAttributeMap.create({
        data: {
          channel: CHANNEL.FLIPKART,
          productType: `${type}-bag`,
          fact: "material",
          theirAttribute: "Material",
          checkedOn,
        },
      });
      expect(row.theirAttribute).toBe("Material");
      await prisma.channelAttributeMap.deleteMany({ where: { productType: `${type}-bag` } });
    });
  });

  describe("what they call an answer", () => {
    it("takes one of their words per channel, list and value", async () => {
      const row = await prisma.channelValueMap.create({
        data: {
          channel: CHANNEL.MEESHO,
          list,
          valueKey: "maroon",
          theirValue: "Maroon",
          checkedSource: "Meesho catalogue template, Validation sheet",
          checkedOn,
        },
      });
      expect(row.checkedOn).toBeInstanceOf(Date);
    });

    it("refuses a second word for the same value", async () => {
      await expect(
        prisma.channelValueMap.create({
          data: { channel: CHANNEL.MEESHO, list, valueKey: "maroon", theirValue: "Wine", checkedOn },
        }),
      ).rejects.toThrow(/Unique constraint/i);
    });

    // Not a uniqueness rule but the reason the key is shaped this way: two of our values may be
    // the same word to a channel whose vocabulary is coarser than ours.
    it("lets two of our values share one of theirs", async () => {
      const row = await prisma.channelValueMap.create({
        data: { channel: CHANNEL.MEESHO, list, valueKey: "wine", theirValue: "Maroon", checkedOn },
      });
      expect(row.theirValue).toBe("Maroon");
    });
  });

  describe("where a shop has said it sells", () => {
    it("holds one row per shop and channel, off until it is turned on", async () => {
      const row = await prisma.orgChannel.create({
        data: { orgId, channel: CHANNEL.MEESHO },
      });
      expect(row.enabled).toBe(false);
    });

    it("refuses the same shop and channel twice", async () => {
      await expect(
        prisma.orgChannel.create({ data: { orgId, channel: CHANNEL.MEESHO, enabled: true } }),
      ).rejects.toThrow(/Unique constraint/i);
    });

    it("goes with the shop when it goes — it is the shop's choice, not a fact about the channel", async () => {
      const org = await prisma.org.create({
        data: {
          code: `CRX-${stamp}`,
          handle: `${stamp}x`,
          name: "Doomed",
          email: `${stamp}x@example.invalid`,
        },
        select: { id: true },
      });
      await prisma.orgChannel.create({ data: { orgId: org.id, channel: CHANNEL.FLIPKART } });
      await prisma.org.delete({ where: { id: org.id } });
      expect(await prisma.orgChannel.findMany({ where: { orgId: org.id } })).toHaveLength(0);
    });
  });
});
