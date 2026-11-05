import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

/**
 * The one way to reach `ListingValue`
 * ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)) — the permitted answers to
 * the listing facts ([categories](../../docs/specs/listing-vocabulary/categories/) D3, D5).
 *
 * One list serves every product type that asks for it, rather than a list per type: Flipkart
 * copies its colour list per node and they have drifted — thirty-five values of which only
 * sixteen appear in every node (D5).
 *
 * Reads are always **by list**, never all of them: there are over a thousand rows and a product
 * form needs the handful of lists its own type asks about (product-types D5).
 */

export interface ListingValueOption {
  key: string;
  label: string;
  /** Null for a platform answer. Set when a shop added its own, and visible only to that shop. */
  orgId: string | null;
}

const SELECT = { key: true, label: true, orgId: true } as const;

export const listingValueRepository = {
  /**
   * The answers for several lists at once, keyed by list.
   *
   * One query rather than one per list — a form asking six questions would otherwise cost six
   * round trips to render once. A shop's own additions come back alongside the platform's, and
   * nothing else's: one shop's vocabulary never widens another's.
   */
  async byLists(
    lists: readonly string[],
    orgId: string | null,
  ): Promise<Record<string, ListingValueOption[]>> {
    const wanted = [...new Set(lists.filter(Boolean))];
    if (wanted.length === 0) return {};

    const rows = await prisma.listingValue.findMany({
      where: {
        list: { in: wanted },
        // Retired answers stay readable on a product that stored one, but are never offered
        // again ([ADR-0032](../../docs/adr/0032-records-people-authored-are-retired-not-deleted.md)).
        retiredAt: null,
        OR: [{ orgId: null }, ...(orgId ? [{ orgId }] : [])],
      },
      orderBy: [{ order: "asc" }, { label: "asc" }],
      select: { ...SELECT, list: true },
    });

    const out: Record<string, ListingValueOption[]> = {};
    for (const list of wanted) out[list] = [];
    for (const row of rows) {
      out[row.list]?.push({ key: row.key, label: row.label, orgId: row.orgId });
    }
    return out;
  },

  /** One answer by its key, so a stored value can be shown by its label rather than its key. */
  async byKey(list: string, key: string, orgId: string | null): Promise<ListingValueOption | null> {
    return prisma.listingValue.findFirst({
      where: { list, key, OR: [{ orgId: null }, ...(orgId ? [{ orgId }] : [])] },
      // A shop's own answer wins over the platform's for that shop, which is what the per-org
      // uniqueness allows and why this orders by `orgId` descending rather than taking any row.
      orderBy: { orgId: "desc" },
      select: SELECT,
    });
  },

  /**
   * A shop adding an answer the platform does not know (spec R6). Scoped to the org, so it is
   * that shop's vocabulary and nobody else's.
   */
  async addForOrg(
    orgId: string,
    list: string,
    key: string,
    label: string,
  ): Promise<ListingValueOption> {
    return prisma.listingValue.create({
      data: { orgId, list, key, label, order: 9999 },
      select: SELECT,
    });
  },

  /** What the lists hold, for a screen that reports on the vocabulary rather than renders it. */
  async counts(): Promise<Record<string, number>> {
    const rows = await prisma.listingValue.groupBy({
      by: ["list"],
      where: { retiredAt: null },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((row) => [row.list, row._count._all]));
  },
  /**
   * A platform answer for a list, made once (setup-requests D6, Q15): an answer a marketplace allows that
   * the list lacks. Existing keys are left as they are; returns the keys written.
   */
  async addPlatformValues(list: string, values: ReadonlyArray<{ key: string; label: string }>, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<number> {
    if (values.length === 0) return 0;
    const existing = await db.listingValue.findMany({ where: { list, orgId: null, key: { in: values.map((v) => v.key) } }, select: { key: true } });
    const have = new Set(existing.map((e) => e.key));
    const fresh = values.filter((v) => !have.has(v.key));
    if (fresh.length === 0) return 0;
    const { count } = await db.listingValue.createMany({ data: fresh.map((v) => ({ list, key: v.key, label: v.label, order: 9000 })) });
    return count;
  },
};
