/**
 * The register's worklist, against a real schema
 * ([channel-registry](../../docs/specs/channel-registry/) R5, R8, spec A3, A5).
 *
 * What makes this worth a database test rather than a unit test is where the list comes from:
 * the answers products actually give, read out of a JSON column. The rule that matters is that
 * it shortens — one decision clears every product sharing that value — because a worklist that
 * never shortens is one nobody finishes.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { CHANNEL } from "@server/shared/channels";
import { FACT, LIST, ORIGIN } from "@server/catalog/listing-facts";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("the channel register (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/catalog/channel-register.service").channelRegisterService;
  let maps: typeof import("@server/catalog/channel-map.repository").channelMapRepository;

  const stamp = `reg-${Date.now().toString(36)}`;
  const node = `${stamp}-node`;
  const madeUp = `${stamp}-colour`;
  const checkedOn = new Date("2026-10-04");
  const productIds: string[] = [];
  let orgId: string;
  let categoryId: string;
  let orgAddressId: string;

  const addProduct = async (colour: string, n: number) => {
    const row = await prisma.product.create({
      data: {
        name: `${stamp} ${colour} ${n}`,
        slug: `${stamp}-${n}`,
        description: "Worklist fixture",
        thumbnail: "https://media.test/worklist.webp",
        price: 100_000,
        orgId,
        categoryId,
        productType: `${stamp}-type`,
        kind: "rida",
        facts: { [FACT.COLOUR]: { value: colour, origin: ORIGIN.PRODUCT } },
        stockLocations: { create: { orgAddressId, quantity: 1 } },
      },
      select: { id: true },
    });
    productIds.push(row.id);
    return row.id;
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelRegisterService: service } = await import(
      "@server/catalog/channel-register.service"
    ));
    ({ channelMapRepository: maps } = await import("@server/catalog/channel-map.repository"));
    ({ orgId, categoryId, orgAddressId } = await ensureFixtures());

    // `Product.productType` is a foreign key, so the type exists before the products do.
    await prisma.productType.create({
      data: {
        key: `${stamp}-type`,
        label: "Worklist fixture",
        facts: [FACT.COLOUR],
        measures: [],
        variantAxis: [],
        kinds: [{ key: "rida", label: "Rida" }],
        factLabels: {},
        labelFrom: [],
      },
    });

    // A node that asks colour from a closed list, so an unmapped answer is real work.
    await maps.setCategory({
      channel: CHANNEL.FLIPKART,
      productType: `${stamp}-type`,
      kind: null,
      theirCategory: node,
      fit: "EXACT",
      checkedOn,
    });
    await maps.setAttribute({
      channel: CHANNEL.FLIPKART,
      theirCategory: node,
      fact: FACT.COLOUR,
      theirAttribute: "Color",
      required: true,
      checkedOn,
    });

    await Promise.all([addProduct(madeUp, 1), addProduct(madeUp, 2), addProduct("black", 3)]);
  });

  afterAll(async () => {
    // Products first: `Product.productType` is a foreign key, so the type cannot go before them.
    await prisma.product.deleteMany({ where: { slug: { startsWith: stamp } } });
    await prisma.channelCategoryMap.deleteMany({ where: { productType: `${stamp}-type` } });
    await prisma.channelAttributeMap.deleteMany({ where: { theirCategory: node } });
    await prisma.channelValueMap.deleteMany({ where: { valueKey: madeUp } });
    await prisma.productType.deleteMany({ where: { key: `${stamp}-type` } });
  });

  const entryFor = async (value: string) =>
    (await service.view(CHANNEL.FLIPKART)).unmappedValues.find((row) => row.valueKey === value);

  it("lists an answer products give that the channel has no word for", async () => {
    const entry = await entryFor(madeUp);
    expect(entry).toBeDefined();
    expect(entry?.list).toBe(LIST.COLOUR);
    expect(entry?.facts).toContain(FACT.COLOUR);
  });

  // Spec A3: shown once rather than per product. Two products, one row, counted as two.
  it("counts the products sharing a value rather than listing it twice", async () => {
    const view = await service.view(CHANNEL.FLIPKART);
    const rows = view.unmappedValues.filter((row) => row.valueKey === madeUp);
    expect(rows).toHaveLength(1);
    expect(rows[0].products).toBe(2);
  });

  it("does not ask about an answer the channel already has a word for", async () => {
    expect(await entryFor("black")).toBeUndefined();
  });

  // Spec A5: the owner records a mapping and the next answer reflects it, with no deploy.
  it("drops off the list the moment the decision is recorded", async () => {
    await maps.setValue({
      channel: CHANNEL.FLIPKART,
      list: LIST.COLOUR,
      valueKey: madeUp,
      theirValue: "Mustard",
      checkedOn,
      checkedSource: "Decided in the channel register",
    });
    expect(await entryFor(madeUp)).toBeUndefined();
  });

  it("takes a correction to a mapping already made, rather than adding a second", async () => {
    await maps.setValue({
      channel: CHANNEL.FLIPKART,
      list: LIST.COLOUR,
      valueKey: madeUp,
      theirValue: "Ochre",
      checkedOn,
      checkedSource: "Decided in the channel register",
    });
    const rows = await prisma.channelValueMap.findMany({ where: { valueKey: madeUp } });
    expect(rows).toHaveLength(1);
    expect(rows[0].theirValue).toBe("Ochre");
  });

  // A channel that takes any text needs no mapping, so nothing it asks about can be work.
  it("asks nothing about a channel whose field is free text", async () => {
    const view = await service.view(CHANNEL.GOOGLE);
    expect(view.unmappedValues.map((row) => row.valueKey)).not.toContain(madeUp);
  });

  it("says nothing about a type that already has a category here", async () => {
    const view = await service.view(CHANNEL.FLIPKART);
    expect(view.unmappedCategories.map((row) => row.productType)).not.toContain(`${stamp}-type`);
  });

  it("names a type that sells here with nowhere to go on this channel", async () => {
    await prisma.channelCategoryMap.deleteMany({ where: { productType: `${stamp}-type` } });
    const view = await service.view(CHANNEL.FLIPKART);
    const entry = view.unmappedCategories.find((row) => row.productType === `${stamp}-type`);
    expect(entry?.products).toBe(3);
  });

  describe("a type decided against rather than overlooked", () => {
    it("moves out of the worklist and into the decisions beside it", async () => {
      await maps.setCategory({
        channel: CHANNEL.FLIPKART,
        productType: `${stamp}-type`,
        kind: null,
        theirCategory: null,
        notSold: true,
        fit: "EXACT",
        checkedOn,
        checkedSource: "Decided in the channel register: not sold here",
      });

      const view = await service.view(CHANNEL.FLIPKART);
      expect(view.unmappedCategories.map((row) => row.productType)).not.toContain(`${stamp}-type`);
      const entry = view.notSold.find((row) => row.productType === `${stamp}-type`);
      expect(entry?.products).toBe(3);
    });

    // The reason it is listed rather than hidden: a decision you cannot find is one you cannot
    // take back, which would be a worse problem than the worklist it quieted.
    it("goes back on the worklist when the decision is taken back", async () => {
      await maps.clearCategory({
        channel: CHANNEL.FLIPKART,
        productType: `${stamp}-type`,
        kind: null,
      });
      const view = await service.view(CHANNEL.FLIPKART);
      expect(view.notSold.map((row) => row.productType)).not.toContain(`${stamp}-type`);
      expect(view.unmappedCategories.map((row) => row.productType)).toContain(`${stamp}-type`);
    });

    it("refuses a row that claims both a category and nowhere", async () => {
      await expect(
        prisma.channelCategoryMap.create({
          data: {
            channel: CHANNEL.FLIPKART,
            productType: `${stamp}-type`,
            kind: "rida",
            theirCategory: "somewhere",
            notSold: true,
            checkedOn,
          },
        }),
        // Named, not merely "it threw": the rule is the database CHECK, and a row rejected for
        // some other reason would pass a bare assertion while proving nothing.
      ).rejects.toThrow(/ChannelCategoryMap_sold_xor_not|constraint/i);
    });
  });

  it("leaves an archived product's answer off the list — it has left sale", async () => {
    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { archivedAt: new Date() },
    });
    await prisma.channelValueMap.deleteMany({ where: { valueKey: madeUp } });
    expect(await entryFor(madeUp)).toBeUndefined();
  });
});
