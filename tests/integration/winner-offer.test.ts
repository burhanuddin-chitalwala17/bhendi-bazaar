/**
 * The offer chain against a real database (winner-offer D1, D4, D8).
 *
 * What is pinned is what Postgres decides: two triggers stepping one chain at once open one
 * offer (the partial unique index and the event lock), an accept at the deadline is refused
 * by the guard, a missed deadline passes the item on, running out records the auction unsold,
 * a paid order completes it at the bid, and an event from before offers is never touched.
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

const created = { events: [] as string[], products: [] as string[], orders: [] as string[] };

describe.skipIf(!isDisposableDb)("winner offers (local db)", () => {
  /** An ended auction on a fresh one-unit product, with the given guest bids placed. */
  async function endedAuction(
    bids: { amountPaise: number; phone: string; email: string | null }[],
    options: { claimWindowHours?: number | null } = {}
  ) {
    const { prisma } = await import("@server/shared/prisma");
    const { orgId, orgAddressId, categoryId, userId } = await ensureFixtures();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const product = await prisma.product.create({
      data: {
        slug: `offer-test-${suffix}`,
        name: `Offer test ${suffix}`,
        description: "Created by tests/integration/winner-offer.test.ts",
        price: 200_000,
        categoryId,
        orgId,
        thumbnail: "https://placehold.co/600x600",
        stockLocations: { create: { orgAddressId, quantity: 1 } },
      },
      select: { id: true },
    });
    created.products.push(product.id);

    const now = Date.now();
    const top = Math.max(...bids.map((bid) => bid.amountPaise), 200_000);
    const event = await prisma.biddingEvent.create({
      data: {
        slug: `o-${suffix}`,
        productId: product.id,
        orgId,
        createdById: userId,
        startAt: new Date(now - 7_200_000),
        endAt: new Date(now - 60_000),
        startingBidPaise: 200_000,
        maxIncreasePaise: 500_000,
        quickBidsPaise: [5_000],
        referencePricePaise: 200_000,
        highestBidPaise: bids.length ? top : null,
        bidCount: bids.length,
        claimWindowHours: options.claimWindowHours === undefined ? 12 : options.claimWindowHours,
      },
      select: { id: true },
    });
    created.events.push(event.id);

    for (const bid of bids) {
      await prisma.bid.create({
        data: {
          eventId: event.id,
          amountPaise: bid.amountPaise,
          guestName: `Guest ${bid.phone}`,
          guestPhone: bid.phone,
          guestEmail: bid.email,
        },
      });
    }
    return event.id;
  }

  async function offersOf(eventId: string) {
    const { prisma } = await import("@server/shared/prisma");
    return await prisma.bidOffer.findMany({
      where: { eventId },
      orderBy: { sequence: "asc" },
      include: { bid: { select: { amountPaise: true, guestPhone: true } } },
    });
  }

  it("opens exactly one offer when two triggers step the chain at once", async () => {
    const { offerService } = await import("@server/bidding/offer.service");
    const eventId = await endedAuction([
      { amountPaise: 260_000, phone: "9000000001", email: "a@example.invalid" },
      { amountPaise: 250_000, phone: "9000000002", email: "b@example.invalid" },
    ]);

    const outcomes = await Promise.all([offerService.advance(eventId), offerService.advance(eventId)]);

    const offers = await offersOf(eventId);
    expect(offers).toHaveLength(1);
    expect(offers[0].status).toBe("OFFERED");
    expect(offers[0].bid.amountPaise).toBe(260_000);
    expect(outcomes.map((o) => o.kind).sort()).toEqual(["idle", "offered"]);
  });

  it("skips a bidder with no email, and offers the next person their own highest bid", async () => {
    const { offerService } = await import("@server/bidding/offer.service");
    const eventId = await endedAuction([
      { amountPaise: 300_000, phone: "9000000011", email: null },
      { amountPaise: 280_000, phone: "9000000012", email: "c@example.invalid" },
      { amountPaise: 270_000, phone: "9000000011", email: "late@example.invalid" },
      { amountPaise: 240_000, phone: "9000000012", email: "c@example.invalid" },
    ]);

    await offerService.advance(eventId);

    const offers = await offersOf(eventId);
    expect(offers.map((o) => [o.status, o.bid.amountPaise])).toEqual([
      ["SKIPPED", 300_000],
      ["OFFERED", 280_000],
    ]);
    expect(offers[0].expiresAt).toBeNull();
  });

  it("refuses an accept at exactly the deadline and takes one just before it", async () => {
    const { offerService } = await import("@server/bidding/offer.service");
    const { bidOfferRepository } = await import("@server/bidding/bid-offer.repository");
    const eventId = await endedAuction([
      { amountPaise: 220_000, phone: "9000000021", email: "d@example.invalid" },
    ]);
    await offerService.advance(eventId);
    const [offer] = await offersOf(eventId);
    const deadline = offer.expiresAt as Date;

    expect(await bidOfferRepository.accept(offer.id, deadline)).toBe(false);
    expect(await bidOfferRepository.accept(offer.id, new Date(deadline.getTime() - 1))).toBe(true);
  });

  it("passes a missed deadline to the next bidder, then records the auction unsold when nobody is left", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { offerService } = await import("@server/bidding/offer.service");
    const eventId = await endedAuction([
      { amountPaise: 230_000, phone: "9000000031", email: "e@example.invalid" },
      { amountPaise: 210_000, phone: "9000000032", email: "f@example.invalid" },
    ]);

    await offerService.advance(eventId);
    const [first] = await offersOf(eventId);
    const afterFirst = new Date((first.expiresAt as Date).getTime() + 1);
    expect((await offerService.advance(eventId, afterFirst)).kind).toBe("offered");

    const [, second] = await offersOf(eventId);
    const afterSecond = new Date((second.expiresAt as Date).getTime() + 1);
    expect((await offerService.advance(eventId, afterSecond)).kind).toBe("exhausted");

    const offers = await offersOf(eventId);
    expect(offers.map((o) => o.status)).toEqual(["LAPSED", "LAPSED"]);
    const event = await prisma.biddingEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe("UNSOLD");
    expect(event.settledById).toBeNull();
  });

  it("completes the auction at the bid when the winner's order is paid", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { offerService } = await import("@server/bidding/offer.service");
    const { bidOfferRepository } = await import("@server/bidding/bid-offer.repository");
    const eventId = await endedAuction([
      { amountPaise: 255_000, phone: "9000000041", email: "g@example.invalid" },
    ]);
    await offerService.advance(eventId);
    const [offer] = await offersOf(eventId);
    expect(await bidOfferRepository.accept(offer.id, new Date())).toBe(true);

    const order = await prisma.order.create({
      data: {
        code: `BB-T${Date.now().toString(36).toUpperCase()}`,
        address: {},
        itemsTotal: 255_000,
        grandTotal: 255_000,
        paymentStatus: "paid",
        status: "confirmed",
        bidOfferId: offer.id,
      },
      select: { id: true },
    });
    created.orders.push(order.id);

    expect(await offerService.completeFromPaidOrder(order.id, offer.id)).toBe(true);
    // Idempotent: the payment path and the sweep can both arrive.
    expect(await offerService.completeFromPaidOrder(order.id, offer.id)).toBe(false);

    const event = await prisma.biddingEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(event.status).toBe("SOLD");
    expect(event.soldAmountPaise).toBe(255_000);
    expect(event.soldBidId).toBe(offer.bidId);
    expect((await offersOf(eventId))[0].status).toBe("PAID");
  });

  it("never touches an auction from before offers existed", async () => {
    const { offerService } = await import("@server/bidding/offer.service");
    const { biddingRepository } = await import("@server/bidding/bidding.repository");
    const eventId = await endedAuction(
      [{ amountPaise: 240_000, phone: "9000000051", email: "h@example.invalid" }],
      { claimWindowHours: null }
    );

    expect(await biddingRepository.awaitingFirstOffer(new Date(), 500)).not.toContain(eventId);
    expect((await offerService.advance(eventId)).kind).toBe("idle");
    expect(await offersOf(eventId)).toHaveLength(0);
  });
});

afterAll(async () => {
  if (!isDisposableDb) return;
  const { prisma } = await import("@server/shared/prisma");
  if (created.events.length === 0) return;
  const offers = await prisma.bidOffer.findMany({
    where: { eventId: { in: created.events } },
    select: { id: true },
  });
  const offerIds = offers.map((offer) => offer.id);
  // Any queued job still naming these offers.
  if (offerIds.length > 0) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'offerId' = ANY($2::text[])`,
      JOBS_QUEUE,
      offerIds
    );
  }
  // FK-safe order: orders restrict their offer, offers their bid and event, bids their event.
  await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
  await prisma.biddingEvent.updateMany({
    where: { id: { in: created.events } },
    data: { soldBidId: null, soldAmountPaise: null, status: "CANCELLED" },
  });
  await prisma.bidOffer.deleteMany({ where: { id: { in: offerIds } } });
  await prisma.bid.deleteMany({ where: { eventId: { in: created.events } } });
  await prisma.biddingEvent.deleteMany({ where: { id: { in: created.events } } });
  await prisma.productStock.deleteMany({ where: { productId: { in: created.products } } });
  await prisma.product.deleteMany({ where: { id: { in: created.products } } });
});
