/**
 * The races, against a real database.
 *
 * Mocks cannot test any of this. Every guarantee bidding makes about simultaneous
 * writes is a guarantee about what Postgres does when two transactions contend for one
 * row — a stubbed repository would happily "prove" a design that deadlocks or
 * double-accepts in production. So these run against the local development database
 * and skip anywhere else, the same bargain `join-equivalence.test.ts` makes.
 *
 * What is pinned here: two bids at one amount produce one winner (H1), a bid at the
 * closing instant is refused (H2), two events on one product produce one event (H3),
 * and suspension follows the clock and the bid count rather than a stored flag (D8a).
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";

const dbUrl = process.env.DATABASE_URL ?? "";
const isLocalDb = (() => {
  try {
    const url = new URL(dbUrl);
    return (
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/bhendi_bazaar_dev"
    );
  } catch {
    return false;
  }
})();

const created = { events: [] as string[], products: [] as string[] };

describe.skipIf(!isLocalDb)("bidding concurrency (local db)", () => {
  /** A throwaway product with one unit, hung off whatever the seed already has. */
  async function makeProduct() {
    const { prisma } = await import("@server/shared/prisma");
    const location = await prisma.orgAddress.findFirst({
      select: { id: true, orgId: true },
    });
    const category = await prisma.category.findFirst({ select: { id: true } });
    if (!location || !category) throw new Error("Seed the local database first");

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await prisma.product.create({
      data: {
        slug: `bidding-test-${suffix}`,
        name: `Bidding test ${suffix}`,
        description: "Created by tests/integration/bidding-concurrency.test.ts",
        price: 200_000,
        categoryId: category.id,
        orgId: location.orgId,
        thumbnail: "https://placehold.co/600x600",
        stockLocations: { create: { orgAddressId: location.id, quantity: 1 } },
      },
      select: { id: true, orgId: true },
    });
    created.products.push(product.id);
    return { ...product, orgAddressId: location.id };
  }

  async function makeEvent(
    productId: string,
    orgId: string,
    window: { startAt: Date; endAt: Date }
  ) {
    const { prisma } = await import("@server/shared/prisma");
    const admin = await prisma.user.findFirst({ select: { id: true } });
    if (!admin) throw new Error("Seed the local database first");

    const event = await prisma.biddingEvent.create({
      data: {
        slug: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId,
        orgId,
        createdById: admin.id,
        startAt: window.startAt,
        endAt: window.endAt,
        startingBidPaise: 200_000,
        maxIncreasePaise: 100_000,
        quickBidsPaise: [5_000, 10_000],
        referencePricePaise: 200_000,
      },
      select: { id: true, slug: true },
    });
    created.events.push(event.id);
    return event;
  }

  it("accepts exactly one of two identical simultaneous bids", async () => {
    const { biddingRepository } = await import("@server/bidding/bidding.repository");
    const product = await makeProduct();
    const now = new Date();
    const event = await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 600_000),
    });

    // Genuinely concurrent: both guards evaluate against the same starting row.
    const results = await Promise.all([
      biddingRepository.acceptBid({ eventId: event.id, amountPaise: 200_000, now }),
      biddingRepository.acceptBid({ eventId: event.id, amountPaise: 200_000, now }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);

    const { prisma } = await import("@server/shared/prisma");
    const row = await prisma.biddingEvent.findUniqueOrThrow({
      where: { id: event.id },
      select: { highestBidPaise: true, bidCount: true },
    });
    // The loser incremented nothing: the count is the number of accepted bids, not of
    // attempts, because both live in one guarded statement.
    expect(row.highestBidPaise).toBe(200_000);
    expect(row.bidCount).toBe(1);
  });

  it("refuses a bid that does not beat the current high", async () => {
    const { biddingRepository } = await import("@server/bidding/bidding.repository");
    const product = await makeProduct();
    const now = new Date();
    const event = await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 600_000),
    });

    expect(
      await biddingRepository.acceptBid({ eventId: event.id, amountPaise: 200_000, now })
    ).toBe(true);
    expect(
      await biddingRepository.acceptBid({ eventId: event.id, amountPaise: 200_000, now })
    ).toBe(false);
    expect(
      await biddingRepository.acceptBid({ eventId: event.id, amountPaise: 199_000, now })
    ).toBe(false);
  });

  it("refuses a bid at the exact closing instant, and after it", async () => {
    const { biddingRepository } = await import("@server/bidding/bidding.repository");
    const product = await makeProduct();
    const endAt = new Date();
    const event = await makeEvent(product.id, product.orgId, {
      startAt: new Date(endAt.getTime() - 600_000),
      endAt,
    });

    // `endAt > now` in the guard, so the closing instant is already over — and the
    // phase derivation on the page agrees, which is the point of pinning both.
    expect(
      await biddingRepository.acceptBid({ eventId: event.id, amountPaise: 200_000, now: endAt })
    ).toBe(false);
    expect(
      await biddingRepository.acceptBid({
        eventId: event.id,
        amountPaise: 200_000,
        now: new Date(endAt.getTime() + 1),
      })
    ).toBe(false);
  });

  it("refuses a bid before the window opens", async () => {
    const { biddingRepository } = await import("@server/bidding/bidding.repository");
    const product = await makeProduct();
    const now = new Date();
    const event = await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() + 600_000),
      endAt: new Date(now.getTime() + 1_200_000),
    });

    expect(
      await biddingRepository.acceptBid({ eventId: event.id, amountPaise: 200_000, now })
    ).toBe(false);
  });

  it("makes two bids at the same amount impossible even bypassing the guard", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const product = await makeProduct();
    const now = new Date();
    const event = await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 600_000),
    });

    const bid = {
      eventId: event.id,
      amountPaise: 200_000,
      guestName: "Test",
      guestPhone: "9999999999",
    };
    await prisma.bid.create({ data: bid });
    // The unique index, not the guard: a tie cannot exist in the data whatever the
    // application does (bidding D6).
    await expect(prisma.bid.create({ data: bid })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("allows only one open event per product", async () => {
    const product = await makeProduct();
    const now = new Date();
    await makeEvent(product.id, product.orgId, {
      startAt: now,
      endAt: new Date(now.getTime() + 600_000),
    });

    // The partial unique index arbitrates, so two tabs cannot both succeed (spec R7).
    await expect(
      makeEvent(product.id, product.orgId, {
        startAt: now,
        endAt: new Date(now.getTime() + 600_000),
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("frees the product once an outcome is recorded, and lets a new event open", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { lockedAmong } = await import("@server/bidding/bidding-lock");
    const product = await makeProduct();
    const now = new Date();
    const event = await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 600_000),
    });

    expect(await lockedAmong([product.id], now)).toEqual(new Set([product.id]));

    await prisma.biddingEvent.update({
      where: { id: event.id },
      data: { status: "UNSOLD", settledAt: now },
    });

    expect(await lockedAmong([product.id], now)).toEqual(new Set());
    // A settled event leaves the partial index, so the product can go up again.
    await expect(
      makeEvent(product.id, product.orgId, {
        startAt: now,
        endAt: new Date(now.getTime() + 600_000),
      })
    ).resolves.toBeTruthy();
  });

  it("stops suspending an expired event that drew no bids, with no cleanup", async () => {
    const { lockedAmong } = await import("@server/bidding/bidding-lock");
    const product = await makeProduct();
    const now = new Date();
    await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() - 1_200_000),
      endAt: new Date(now.getTime() - 600_000),
    });

    // Still OPEN in the database, and still not suspending — the clause is the clock
    // plus the bid count, never a stored flag someone had to remember to clear (D8a).
    expect(await lockedAmong([product.id], now)).toEqual(new Set());
  });

  it("keeps suspending an expired event that drew bids, until it is settled", async () => {
    const { biddingRepository } = await import("@server/bidding/bidding.repository");
    const { lockedAmong } = await import("@server/bidding/bidding-lock");
    const product = await makeProduct();
    const now = new Date();
    const liveUntil = new Date(now.getTime() + 600_000);
    const event = await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() - 60_000),
      endAt: liveUntil,
    });
    await biddingRepository.acceptBid({
      eventId: event.id,
      amountPaise: 200_000,
      now,
    });

    const afterClose = new Date(liveUntil.getTime() + 1_000);
    expect(await lockedAmong([product.id], afterClose)).toEqual(new Set([product.id]));
  });

  it("refuses a purchase of a suspended product", async () => {
    const { assertNotUnderBidding } = await import("@server/bidding/bidding-lock");
    const product = await makeProduct();
    const now = new Date();
    await makeEvent(product.id, product.orgId, {
      startAt: new Date(now.getTime() - 60_000),
      endAt: new Date(now.getTime() + 600_000),
    });

    await expect(assertNotUnderBidding([product.id], now)).rejects.toThrow(
      /up for bidding/i
    );
  });
});

afterAll(async () => {
  if (!isLocalDb) return;
  const { prisma } = await import("@server/shared/prisma");
  // FK-safe order: bids restrict their event, and events restrict their product.
  if (created.events.length > 0) {
    await prisma.bid.deleteMany({ where: { eventId: { in: created.events } } });
    await prisma.biddingEvent.deleteMany({ where: { id: { in: created.events } } });
  }
  if (created.products.length > 0) {
    await prisma.productStock.deleteMany({
      where: { productId: { in: created.products } },
    });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
  }
});
