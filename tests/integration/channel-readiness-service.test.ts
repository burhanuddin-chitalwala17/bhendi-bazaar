/**
 * The gate's caller, against a real schema ([channel-registry](../../docs/specs/channel-registry/)
 * D2, D5). The rules are unit-tested in `tests/unit/channel-readiness.test.ts`; what is checked
 * here is what only a database can answer — that the four reads assemble into the register the
 * pure function expects, that a shop's own enablement is what decides, and that a mapping edited
 * now is reflected in the next verdict with no deploy (spec A5).
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi, type MockInstance } from "vitest";

import { CHANNEL } from "@server/shared/channels";
import { FACT, LIST, ORIGIN } from "@server/listing/listing-facts";
import { LISTING_PROBLEM, LISTING_READINESS } from "@server/listing/channel-readiness";
import { isDisposableDb, ensureFixtures, setAnswers } from "../helpers/test-db";

// Counted the way `db-ops-budget.test.ts` counts: one `prisma:query` line per billed statement,
// and the instrument has to be set before the client module loads.
process.env.PRISMA_LOG_QUERIES = "1";
let queries = 0;
let spy: MockInstance;

async function countQueries(run: () => Promise<unknown>): Promise<number> {
  queries = 0;
  await run();
  return queries;
}

describe.skipIf(!isDisposableDb)("readiness, read through (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/listing/channel-readiness.service").channelReadinessService;
  let maps: typeof import("@server/listing/channel-map.repository").channelMapRepository;
  let orgChannels: typeof import("@server/listing/org-channel.repository").orgChannelRepository;

  const stamp = `crs-${Date.now().toString(36)}`;
  const typeKey = `${stamp}-rida`;
  const theirNode = `${stamp}-ethnic-wear/abaya`;
  // Stamped, not real: this suite used `maroon` and `ochre` and deleted them afterwards, which
  // took the platform's seeded mappings with them. A fixture owns only what it invented.
  const mapped = `${stamp}-mapped`;
  const unmapped = `${stamp}-unmapped`;
  const checkedOn = new Date("2026-10-04");
  let orgId: string;

  const facts = (answers: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(answers).map(([key, value]) => [key, { value, origin: ORIGIN.PRODUCT }]),
    );

  const subject = (kind: string | null, answers: Record<string, string>) => ({
    productType: typeKey,
    kind,
    facts: facts(answers),
  });

  beforeAll(async () => {
    spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("prisma:query")) queries += 1;
    });
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelReadinessService: service } = await import(
      "@server/listing/channel-readiness.service"
    ));
    ({ channelMapRepository: maps } = await import("@server/listing/channel-map.repository"));
    ({ orgChannelRepository: orgChannels } = await import(
      "@server/listing/org-channel.repository"
    ));
    ({ orgId } = await ensureFixtures());

    await prisma.productType.create({
      data: {
        key: typeKey,
        label: "Rida (test)",
        facts: [FACT.COLOUR, FACT.MATERIAL],
        measures: [],
        variantAxis: [],
        kinds: [
          { key: "rida", label: "Rida" },
          { key: "abaya", label: "Abaya" },
        ],
        factLabels: {},
        labelFrom: [],
        labelScale: undefined,
      },
    });

    // The whole type goes to one node on Flipkart, except a rida, which has none of its own.
    await maps.setCategory({
      channel: CHANNEL.FLIPKART,
      productType: typeKey,
      kind: null,
      theirCategory: theirNode,
      fit: "EXACT",
      checkedOn,
    });
    await maps.setCategory({
      channel: CHANNEL.FLIPKART,
      productType: typeKey,
      kind: "rida",
      theirCategory: theirNode,
      fit: "NEAREST",
      note: "Flipkart has no rida node.",
      checkedOn,
    });
    // Keyed by their node, not our type: that is where a required-field set belongs, and both
    // category rows above resolve here.
    await maps.setAttribute({
      channel: CHANNEL.FLIPKART,
      theirCategory: theirNode,
      fact: FACT.COLOUR,
      theirAttribute: "Color",
      required: true,
      checkedOn,
    });
    await maps.setValue({
      channel: CHANNEL.FLIPKART,
      list: LIST.COLOUR,
      valueKey: mapped,
      theirValue: "Their word for it",
      checkedOn,
    });
  });

  afterAll(async () => {
    spy?.mockRestore();
    await Promise.all([
      prisma.channelCategoryMap.deleteMany({ where: { productType: typeKey } }),
      prisma.channelAttributeMap.deleteMany({ where: { theirCategory: theirNode } }),
      prisma.channelValueMap.deleteMany({ where: { valueKey: { in: [mapped, unmapped] } } }),
      prisma.orgChannel.deleteMany({ where: { orgId } }),
    ]);
    await prisma.productType.deleteMany({ where: { key: typeKey } });
  });

  it("says nothing while the shop has enabled no channel", async () => {
    expect(await service.forProduct(orgId, subject("abaya", { [FACT.COLOUR]: mapped }))).toEqual(
      [],
    );
  });

  it("still says nothing for a channel the shop turned on and off again", async () => {
    await orgChannels.set(orgId, CHANNEL.FLIPKART, true);
    await orgChannels.set(orgId, CHANNEL.FLIPKART, false);
    expect(await service.forProduct(orgId, subject("abaya", { [FACT.COLOUR]: mapped }))).toEqual(
      [],
    );
  });

  describe("once the shop sells there", () => {
    beforeAll(async () => {
      await orgChannels.set(orgId, CHANNEL.FLIPKART, true);
    });

    it("is ready for a kind the type's own mapping covers", async () => {
      const [verdict] = await service.forProduct(
        orgId,
        subject("abaya", { [FACT.COLOUR]: mapped }),
      );
      expect(verdict.channel).toBe(CHANNEL.FLIPKART);
      expect(verdict.report.state).toBe(LISTING_READINESS.READY);
      expect(verdict.report.theirCategory).toBe(theirNode);
    });

    it("warns on the kind whose mapping is only the nearest they have", async () => {
      const [verdict] = await service.forProduct(
        orgId,
        subject("rida", { [FACT.COLOUR]: mapped }),
      );
      expect(verdict.report.state).toBe(LISTING_READINESS.WARNED);
      expect(verdict.report.problems[0]).toMatchObject({
        problem: LISTING_PROBLEM.NEAREST_CATEGORY,
        note: "Flipkart has no rida node.",
      });
    });

    it("reads incomplete for an answer the channel has no word for", async () => {
      const [verdict] = await service.forProduct(
        orgId,
        subject("abaya", { [FACT.COLOUR]: unmapped }),
      );
      expect(verdict.report.state).toBe(LISTING_READINESS.INCOMPLETE);
      expect(verdict.report.problems[0]).toMatchObject({
        problem: LISTING_PROBLEM.UNMAPPED_VALUE,
        value: unmapped,
      });
    });

    // design-system Q35: the products page's channel pill lists exactly what this read returns.
    it("lists only this shop's on-sale products the channel would refuse, each with why", async () => {
      const fx = await ensureFixtures();
      const make = async (org: string, answers: Record<string, string>, archived = false) => {
        const row = await prisma.product.create({
          data: {
            slug: `${stamp}-p-${Math.random().toString(36).slice(2, 8)}`,
            name: `${stamp} product`,
            description: "Created by channel-readiness-service.test.ts",
            price: 10_000,
            categoryId: fx.categoryId,
            orgId: org,
            thumbnail: "/brand/bhendi-bazaar.png",
            productType: typeKey,
            kind: "abaya",
            archivedAt: archived ? new Date() : null,
          },
          select: { id: true },
        });
        await setAnswers(row.id, { facts: facts(answers) });
        return row;
      };
      const ready = await make(orgId, { [FACT.COLOUR]: mapped });
      const noColour = await make(orgId, {});
      const archivedNoColour = await make(orgId, {}, true);
      const theirs = await make(fx.otherOrgId, {});
      const ids = [ready.id, noColour.id, archivedNoColour.id, theirs.id];
      try {
        const refused = await service.notReadyOn(orgId, CHANNEL.FLIPKART);
        expect(refused.get(noColour.id)).toEqual([{ kind: LISTING_PROBLEM.MISSING_FACT, fact: FACT.COLOUR, label: expect.any(String) }]);
        expect(refused.has(ready.id)).toBe(false);
        expect(refused.has(archivedNoColour.id)).toBe(false);
        expect(refused.has(theirs.id)).toBe(false);
        // A channel the shop does not sell on refuses nothing, rather than everything.
        expect((await service.notReadyOn(orgId, CHANNEL.MEESHO)).size).toBe(0);
      } finally {
        await prisma.product.deleteMany({ where: { id: { in: ids } } });
      }
    });

    // Spec A5: the owner changes a mapping and the next answer reflects it, with no deploy.
    it("reflects a mapping added a moment ago", async () => {
      await maps.setValue({
        channel: CHANNEL.FLIPKART,
        list: LIST.COLOUR,
        valueKey: unmapped,
        theirValue: "Their other word",
        checkedOn,
      });
      const [verdict] = await service.forProduct(
        orgId,
        subject("abaya", { [FACT.COLOUR]: unmapped }),
      );
      expect(verdict.report.state).toBe(LISTING_READINESS.READY);
      await prisma.channelValueMap.deleteMany({ where: { valueKey: unmapped } });
    });

    it("answers each product of a batch on its own facts and kind", async () => {
      const verdicts = await service.forProducts(orgId, [
        { id: "a", ...subject("abaya", { [FACT.COLOUR]: mapped }) },
        { id: "b", ...subject("rida", { [FACT.COLOUR]: mapped }) },
        { id: "c", ...subject("abaya", { [FACT.COLOUR]: unmapped }) },
        { id: "d", productType: null, kind: null, facts: {} },
      ]);

      expect(verdicts.get("a")?.[0].report.state).toBe(LISTING_READINESS.READY);
      expect(verdicts.get("b")?.[0].report.state).toBe(LISTING_READINESS.WARNED);
      expect(verdicts.get("c")?.[0].report.state).toBe(LISTING_READINESS.INCOMPLETE);
      // A product with no type can be mapped nowhere, which is silence rather than a verdict.
      expect(verdicts.get("d")).toEqual([]);
    });

    /**
     * The register is read per *type*, not per product, which is the whole reason `forProducts`
     * exists beside `forProduct`. A budget rather than a comment, because the regression — a
     * read moved inside the loop — is invisible in a diff and silent in every other test.
     */
    it("costs the same for forty products of a type as for one", async () => {
      const one = await countQueries(() =>
        service.forProducts(orgId, [{ id: "a", ...subject("abaya", { [FACT.COLOUR]: mapped }) }]),
      );
      const forty = await countQueries(() =>
        service.forProducts(
          orgId,
          Array.from({ length: 40 }, (_, i) => ({
            id: `p${i}`,
            ...subject(i % 2 ? "rida" : "abaya", { [FACT.COLOUR]: mapped }),
          })),
        ),
      );

      // The shop's channels (1), the types (1), the three maps (3), the channel's own fields
      // with what fills them (2, listing-model/channel-catalogue D6), and the field maps (1, field-maps D1). Asserted exactly rather
      // than as a bound: an upper bound over an instrument that counts nothing cannot fail, and
      // that is how this project's billed-operations budgets read zero for two months.
      expect(one).toBe(8);
      expect(forty).toBe(one);
    });

    /**
     * The register is read for every type at once, which is what lets the products screen ask
     * about a whole catalogue. A read moved back inside the per-type loop is invisible in a diff
     * and silent in every other test, so it is a budget rather than a comment.
     */
    it("costs the same for many product types as for one", async () => {
      const oneType = await countQueries(() =>
        service.forProducts(orgId, [{ id: "a", ...subject("abaya", { [FACT.COLOUR]: mapped }) }]),
      );
      const manyTypes = await countQueries(() =>
        service.forProducts(orgId, [
          { id: "a", ...subject("abaya", { [FACT.COLOUR]: mapped }) },
          { id: "b", productType: "bag", kind: "handbag", facts: {} },
          { id: "c", productType: "socks", kind: "ankle", facts: {} },
          { id: "d", productType: "jewellery", kind: "ring", facts: {} },
        ]),
      );
      expect(manyTypes).toBe(oneType);
    });

    it("says nothing for a type nothing has mapped, rather than throwing", async () => {
      expect(
        await service.forProduct(orgId, { productType: `${typeKey}-absent`, kind: null, facts: {} }),
      ).toEqual([]);
    });
  });

  describe("correcting a catch-all mapping", () => {
    // Prisma cannot upsert on a compound unique holding a null, so that path is hand-written —
    // which makes "correcting it twice does not make two of it" worth proving against Postgres.
    it("updates the one row rather than adding a second", async () => {
      await maps.setCategory({
        channel: CHANNEL.MEESHO,
        productType: typeKey,
        kind: null,
        theirCategory: "Abayas",
        fit: "EXACT",
        checkedOn,
      });
      const corrected = await maps.setCategory({
        channel: CHANNEL.MEESHO,
        productType: typeKey,
        kind: null,
        theirCategory: "Other Islamic Wear",
        fit: "NEAREST",
        note: "Reclassified after checking their tree.",
        checkedOn,
      });

      expect(corrected.theirCategory).toBe("Other Islamic Wear");
      expect(corrected.fit).toBe("NEAREST");
      const rows = await prisma.channelCategoryMap.findMany({
        where: { channel: CHANNEL.MEESHO, productType: typeKey, kind: null },
      });
      expect(rows).toHaveLength(1);
    });

    it("clears a note the correction did not carry, rather than leaving the old one", async () => {
      const cleared = await maps.setCategory({
        channel: CHANNEL.MEESHO,
        productType: typeKey,
        kind: null,
        theirCategory: "Abayas",
        fit: "EXACT",
        checkedOn,
      });
      expect(cleared.note).toBeNull();
    });
  });
});
