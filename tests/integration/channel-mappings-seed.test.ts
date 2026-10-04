/**
 * The seeded category mappings, checked for internal consistency
 * ([channel-registry](../../docs/specs/channel-registry/) test plan).
 *
 * A mapping naming a product type or a kind that does not exist is the way a bad seed goes
 * unnoticed: nothing fails to compile, and the product it was meant to serve simply reads as
 * having nowhere to go. The same check the product types get, for the same reason.
 *
 * It also pins the decisions the owner took on 2026-10-04, because a mapping silently changing
 * is a listing silently moving to a different part of someone else's shop.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll } from "vitest";

import { CHANNEL, PUBLISHABLE_CHANNELS, isChannel } from "@server/shared/channels";
import { isDisposableDb } from "../helpers/test-db";

interface Row {
  channel: string;
  productType: string;
  kind: string | null;
  theirCategory: string | null;
  fit: "EXACT" | "NEAREST";
  notSold: boolean;
  note: string | null;
  checkedOn: Date;
  checkedSource: string | null;
}

describe.skipIf(!isDisposableDb)("the seeded channel mappings (local db)", () => {
  let rows: Row[];
  let kindsByType: Map<string, Set<string>>;

  beforeAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    rows = await prisma.channelCategoryMap.findMany({
      select: {
        channel: true,
        productType: true,
        kind: true,
        theirCategory: true,
        fit: true,
        notSold: true,
        note: true,
        checkedOn: true,
        checkedSource: true,
      },
    });
    const types = await prisma.productType.findMany({ select: { key: true, kinds: true } });
    kindsByType = new Map(
      types.map((type) => [
        type.key,
        new Set((type.kinds as { key: string }[]).map((kind) => kind.key)),
      ]),
    );
  });

  const seeded = () => rows.filter((row) => row.checkedSource !== null);

  it("seeded something at all — an empty scan is not a passing check", () => {
    expect(seeded().length).toBeGreaterThan(30);
  });

  it("names only channels this codebase declares", () => {
    for (const row of seeded()) expect(isChannel(row.channel), row.channel).toBe(true);
  });

  it("names only product types that exist", () => {
    for (const row of seeded()) {
      expect(kindsByType.has(row.productType), `${row.channel}/${row.productType}`).toBe(true);
    }
  });

  it("names only kinds their own type declares", () => {
    for (const row of seeded()) {
      if (row.kind === null) continue;
      expect(
        kindsByType.get(row.productType)?.has(row.kind),
        `${row.channel}/${row.productType}/${row.kind}`,
      ).toBe(true);
    }
  });

  // D6: a nearest fit is shown with its note every time. One without a note shows nothing, which
  // is the silent approval the column exists to prevent.
  it("gives every nearest fit a note saying why", () => {
    for (const row of seeded().filter((entry) => entry.fit === "NEAREST" && !entry.notSold)) {
      expect(row.note?.trim(), `${row.channel}/${row.productType}/${row.kind ?? "*"}`).toBeTruthy();
    }
  });

  // D4: a mapping is a claim about somebody else's system on a particular day.
  it("dates every mapping and says what it was checked against", () => {
    for (const row of seeded()) {
      expect(row.checkedOn).toBeInstanceOf(Date);
      expect(row.checkedSource?.length).toBeGreaterThan(0);
    }
  });

  it("marks the inferred Flipkart attar node as inferred, in both the fit and the source", () => {
    const attar = seeded().find(
      (row) => row.channel === CHANNEL.FLIPKART && row.kind === "attar",
    );
    expect(attar?.fit, "no template was obtained, so it cannot be exact").toBe("NEAREST");
    expect(attar?.checkedSource).toMatch(/inferred/i);
    expect(attar?.note).toMatch(/template/i);
  });

  describe("the decisions taken on 2026-10-04", () => {
    const find = (channel: string, productType: string, kind: string | null) =>
      seeded().find(
        (row) => row.channel === channel && row.productType === productType && row.kind === kind,
      );

    it("lists a rida under clothing on Google, not religious items", () => {
      const google = find(CHANNEL.GOOGLE, "islamic-wear", null);
      expect(google?.theirCategory).toBe("1604");
      expect(google?.fit).toBe("NEAREST");
    });

    it("lists a rida as an abaya on Flipkart, marked nearest", () => {
      const rida = find(CHANNEL.FLIPKART, "islamic-wear", "rida");
      expect(rida?.theirCategory).toBe("abaya-burqa");
      expect(rida?.fit).toBe("NEAREST");
      expect(rida?.note).toMatch(/no rida node/i);
    });

    it("puts bakhoor with incense rather than perfume, and attar with perfume", () => {
      expect(find(CHANNEL.GOOGLE, "fragrance", "bakhoor")?.theirCategory).toBe("3686");
      expect(find(CHANNEL.GOOGLE, "fragrance", "attar")?.theirCategory).toBe("479");
    });

    it("puts a prayer mat under religious items on Google", () => {
      expect(find(CHANNEL.GOOGLE, "prayer-mat", null)?.theirCategory).toBe("97");
    });

    /**
     * The owner's call: gift, prayer and masalla sets sell on this store only.
     *
     * Asserted as a written decision rather than an absent row. It used to be the absence, and
     * the register could not tell that from nobody having got to it — so it listed 18 masalla
     * bags as work. Every publishable channel carries the row, and none carries a category.
     */
    it("records combos as not sold anywhere, rather than merely unmapped", () => {
      const combos = seeded().filter((row) => row.productType === "combo");
      expect(combos.length).toBe(PUBLISHABLE_CHANNELS.length);
      for (const row of combos) {
        expect(row.notSold, row.channel).toBe(true);
        expect(row.theirCategory, row.channel).toBeNull();
        expect(row.note).toMatch(/this store only/i);
      }
    });

    it("sends a palazzo to Flipkart's trouser node, which carries Palazzos in its Type", () => {
      const palazzo = find(CHANNEL.FLIPKART, "trousers", "palazzo");
      expect(palazzo?.theirCategory).toBe("trouser");
      expect(palazzo?.fit, "their Type field has the exact word").toBe("EXACT");
    });
  });

  // Meta accepts `google_product_category`. They are separate rows so either can move alone, so
  // what is checked is that they have not drifted yet — not that they cannot.
  it("gives Meta the same categories as Google, for now", () => {
    const google = seeded().filter((row) => row.channel === CHANNEL.GOOGLE);
    const meta = seeded().filter((row) => row.channel === CHANNEL.META);
    const shape = (list: Row[]) =>
      list
        .map((row) => `${row.productType}/${row.kind ?? "*"}=${row.theirCategory}`)
        .sort()
        .join("|");

    expect(meta.length).toBe(google.length);
    expect(shape(meta)).toBe(shape(google));
  });
});
