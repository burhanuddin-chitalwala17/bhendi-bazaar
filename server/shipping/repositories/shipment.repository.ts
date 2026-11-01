import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import type { ParcelBooking } from "@server/shipping/domain/shipping.types";

/** `prisma`, or the `tx` of the transaction a caller holds. */
type ShipmentDb = Pick<typeof prisma, "shipment" | "shipmentItem">;
type ParcelEventDb = Pick<typeof prisma, "parcelEvent">;

/** Paid in (`paidAfter`, `paidBefore`]; one shop, or one parcel, when named. */
/** The admin queue's filters (ux.md "admin pickups": by shop, by city) and one page of it. */
export type QueueFilter = { orgId?: string; city?: string };
export type QueuePage = QueueFilter & { skip: number; take: number };

const queueWhere = (status: string, filter: QueueFilter) => ({
  status,
  ...(filter.orgId ? { orgId: filter.orgId } : {}),
  ...(filter.city ? { fromCity: filter.city } : {}),
});

type PackingWindow = { paidBefore: Date; paidAfter: Date | null; orgId?: string; shipmentId?: string };

function packingPaidBeforeWhere(
  statusPacking: string,
  paidStatus: string,
  window: PackingWindow,
  noticeKind: string | null,
): Prisma.ShipmentWhereInput {
  return {
    status: statusPacking,
    ...(window.orgId ? { orgId: window.orgId } : {}),
    ...(window.shipmentId ? { id: window.shipmentId } : {}),
    order: {
      paymentStatus: paidStatus,
      paidAt: { lte: window.paidBefore, ...(window.paidAfter ? { gt: window.paidAfter } : {}) },
    },
    ...(noticeKind ? { notices: { none: { kind: noticeKind } } } : {}),
  };
}

/**
 * The Shipment table's repository (Invariant 5). `status` is written only on
 * `shipment-status.service.ts`'s say-so — `recordTransition` is its statement, moved here so the
 * service holds no Prisma call of its own; the transition table in the service is still the guard.
 */
export class ShipmentRepository {
  async findStatus(id: string, db: ShipmentDb = prisma) {
    return db.shipment.findUnique({
      where: { id },
      select: { id: true, orderId: true, orgId: true, status: true },
    });
  }

  /** What a notice about this parcel names: its code, shop, origin city and order (order-fulfilment D8). */
  async noticeContext(id: string, db: ShipmentDb = prisma) {
    return db.shipment.findUnique({
      where: { id },
      select: {
        id: true, code: true, orgId: true, fromCity: true,
        courierName: true, trackingNumber: true, trackingUrl: true, pickupDate: true, estimatedDelivery: true,
        order: { select: { id: true, code: true } },
      },
    });
  }

  /** The booking as it stands: what a refused booking or date change explains itself from. */
  async bookingOf(id: string, db: ShipmentDb = prisma) {
    return db.shipment.findUnique({
      where: { id },
      select: {
        id: true, code: true, orgId: true, orderId: true, status: true,
        courierName: true, trackingNumber: true, trackingUrl: true, labelUrl: true,
        pickupDate: true, estimatedDelivery: true,
      },
    });
  }

  /** The parcel already holding this AWB, other than `exceptId` — named in the refusal (ux.md book pickup). */
  async holderOfAwb(trackingNumber: string, exceptId: string, db: ShipmentDb = prisma) {
    return db.shipment.findFirst({
      where: { trackingNumber, NOT: { id: exceptId } },
      select: { id: true, code: true },
    });
  }

  /**
   * Move the booked dates, compare-and-set on both dates as last read (order-fulfilment D11):
   * a parcel collected, cancelled or re-dated meanwhile matches nothing, and `false` says so.
   */
  async movePickupDates(
    id: string,
    where: { status: string; seenPickupDate: Date; seenEstimatedDelivery: Date | null },
    next: { pickupDate: Date; estimatedDelivery: Date },
    tx: ShipmentDb,
  ): Promise<boolean> {
    const moved = await tx.shipment.updateMany({
      where: { id, status: where.status, pickupDate: where.seenPickupDate, estimatedDelivery: where.seenEstimatedDelivery },
      data: next,
    });
    return moved.count === 1;
  }

  /** The courier's ETD replaces ours: compare-and-set on the date read, only in a state that still travels (D10). */
  async replaceEstimatedDelivery(
    id: string,
    where: { statuses: string[]; seen: Date | null },
    estimatedDelivery: Date,
    tx: ShipmentDb,
  ): Promise<boolean> {
    const moved = await tx.shipment.updateMany({
      where: { id, status: { in: where.statuses }, estimatedDelivery: where.seen },
      data: { estimatedDelivery },
    });
    return moved.count === 1;
  }

  /** The newest timeline row of `kind`, optionally into `toStatus`: who did it, when, and the dates it set. */
  async lastEvent(id: string, kind: string, toStatus?: string, db: ParcelEventDb = prisma) {
    return db.parcelEvent.findFirst({
      where: { shipmentId: id, kind, ...(toStatus ? { toStatus } : {}) },
      orderBy: { createdAt: "desc" },
      select: { actorName: true, createdAt: true, pickupDate: true, estimatedDelivery: true },
    });
  }

  /** Every timeline row of these parcels, oldest first (order-fulfilment D5, R7). */
  async listEvents(shipmentIds: string[]) {
    if (shipmentIds.length === 0) return [];
    return prisma.parcelEvent.findMany({
      where: { shipmentId: { in: shipmentIds } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        shipmentId: true, kind: true, fromStatus: true, toStatus: true, actor: true, reason: true,
        courierWording: true, pickupDate: true, estimatedDelivery: true, createdAt: true,
      },
    });
  }

  /**
   * The admin's pickup queue for one state (ux.md "admin pickups"): oldest first — by when it
   * became ready, or by its pickup date once booked. Capped; the shop's own address is the pickup address.
   */
  async listQueue(status: string, page: QueuePage, byPickupDate: boolean) {
    return prisma.shipment.findMany({
      where: queueWhere(status, page),
      orderBy: byPickupDate ? [{ pickupDate: "asc" }, { updatedAt: "asc" }, { id: "asc" }] : [{ updatedAt: "asc" }, { id: "asc" }],
      skip: page.skip,
      take: page.take,
      select: {
        id: true, code: true, orgId: true, fromCity: true, fromPincode: true, status: true,
        courierName: true, trackingNumber: true, trackingUrl: true, labelUrl: true,
        pickupDate: true, estimatedDelivery: true,
        org: { select: { name: true, phone: true } },
        order: { select: { id: true, code: true, _count: { select: { shipments: true } } } },
        parcelEvents: { where: { toStatus: status }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
  }

  async countInStatus(status: string, filter: QueueFilter = {}) {
    return prisma.shipment.count({ where: queueWhere(status, filter) });
  }

  /** The last time this parcel moved into `status`, and who moved it — the timeline answers. */
  async lastMoveInto(id: string, status: string, db: ParcelEventDb = prisma) {
    return db.parcelEvent.findFirst({
      where: { shipmentId: id, toStatus: status },
      orderBy: { createdAt: "desc" },
      select: { actor: true, createdAt: true },
    });
  }

  /**
   * Paid parcels still `packing` whose order was paid in (`paidAfter`, `paidBefore`], lacking a
   * `noticeKind` notice when one is named: the sweep's worklist and the admin's not-packed list
   * (order-fulfilment D18). Oldest first, capped.
   */
  async listPackingPaidBefore(
    statusPacking: string,
    paidStatus: string,
    window: PackingWindow,
    noticeKind: string | null,
    limit: number,
  ) {
    return prisma.shipment.findMany({
      where: packingPaidBeforeWhere(statusPacking, paidStatus, window, noticeKind),
      orderBy: { order: { paidAt: "asc" } },
      take: limit,
      select: {
        id: true, code: true, orgId: true, fromCity: true,
        org: { select: { name: true, phone: true, email: true } },
        order: { select: { id: true, code: true, paidAt: true } },
      },
    });
  }

  /** How many parcels match `listPackingPaidBefore`, uncapped — the tab's count, not the page's length. */
  async countPackingPaidBefore(statusPacking: string, paidStatus: string, window: PackingWindow) {
    return prisma.shipment.count({ where: packingPaidBeforeWhere(statusPacking, paidStatus, window, null) });
  }

  /** Parcels in `statusReady` that entered it at or before `readyBefore` and have no `kind` notice yet. */
  async listReadyBefore(statusReady: string, readyBefore: Date, noticeKind: string, limit: number) {
    return prisma.shipment.findMany({
      where: {
        status: statusReady,
        parcelEvents: { some: { toStatus: statusReady, createdAt: { lte: readyBefore } } },
        notices: { none: { kind: noticeKind } },
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
      select: {
        id: true, code: true, orgId: true, fromCity: true,
        order: { select: { id: true, code: true } },
        parcelEvents: { where: { toStatus: statusReady }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
  }

  async findByTrackingNumberWithOrder(trackingNumber: string) {
    return prisma.shipment.findFirst({
      where: { trackingNumber },
      include: { order: true },
    });
  }

  async listStatusesForOrder(orderId: string, db: ShipmentDb = prisma) {
    return db.shipment.findMany({
      where: { orderId },
      select: { status: true },
    });
  }

  async recordProviderWording(id: string, raw: string): Promise<void> {
    await prisma.shipment.update({
      where: { id },
      data: { shipmentStatus: raw },
    });
  }

  /** One parcel of a new order, on the order's own transaction. The location is persisted and its address snapshotted (stock-locations D5/D6). */
  async createForOrder(data: Prisma.ShipmentUncheckedCreateInput, tx: ShipmentDb) {
    return await tx.shipment.create({ data });
  }

  /** The parcels' lines, one statement, on the order's transaction. */
  async createItemsForOrder(rows: Prisma.ShipmentItemCreateManyInput[], tx: ShipmentDb): Promise<void> {
    if (rows.length) await tx.shipmentItem.createMany({ data: rows });
  }

  /**
   * Claim the one restock a parcel gets. Conditional (ADR-0007): a courier repeating a terminal
   * event finds `false` and credits nothing. Read-then-write would be a race, not a check.
   */
  async claimRestock(id: string, tx: ShipmentDb): Promise<boolean> {
    const claimed = await tx.shipment.updateMany({
      where: { id, restockedAt: null },
      data: { restockedAt: new Date() },
    });
    return claimed.count === 1;
  }

  /**
   * The status move `shipment-status.service.ts` decided, conditional on the parcel still being
   * where the caller saw it (order-fulfilment D2). `false` means another move won.
   */
  async recordTransition(
    id: string,
    from: string,
    data: { status: string; shipmentStatus?: string; deliveredAt?: Date } & Partial<ParcelBooking>,
    tx: ShipmentDb,
  ): Promise<boolean> {
    const moved = await tx.shipment.updateMany({ where: { id, status: from }, data });
    return moved.count === 1;
  }

  /** One timeline row, in the transaction that moved the parcel (order-fulfilment D5). */
  async recordEvent(
    data: {
      shipmentId: string; kind?: string; fromStatus: string | null; toStatus: string;
      actor: string; reason?: string | null; courierWording?: string | null;
      pickupDate?: Date | null; estimatedDelivery?: Date | null; actorName?: string | null;
    },
    tx: ParcelEventDb,
  ): Promise<{ id: string }> {
    return await tx.parcelEvent.create({ data, select: { id: true } });
  }

  /** Every parcel of an order with its units, in code order: what a cancel splits shares over (D13, D16). */
  async parcelsOfOrder(orderId: string, tx: ShipmentDb) {
    return await tx.shipment.findMany({
      where: { orderId },
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, orgId: true, shippingCost: true, trackingNumber: true,
        items: { orderBy: { id: "asc" }, select: { orderItemId: true, quantity: true } },
      },
    });
  }

  /**
   * Cancellations by `actor` into `cancelled` since `since`, per shop, most first (order-fulfilment
   * D14: counts come from the timeline). One page, and the total number of shops on it.
   */
  async cancelCountsByOrg(
    by: { actor: string; cancelled: string; since: Date; skip: number; take: number },
  ): Promise<{ rows: { orgId: string; count: number }[]; total: number }> {
    const rows = await prisma.$queryRaw<{ orgId: string; count: bigint }[]>`
      SELECT s."orgId", count(DISTINCT e."shipmentId")::bigint AS count
      FROM "ParcelEvent" e JOIN "Shipment" s ON s.id = e."shipmentId"
      WHERE e."toStatus" = ${by.cancelled} AND e.actor = ${by.actor} AND e."createdAt" >= ${by.since}
      GROUP BY s."orgId"
      ORDER BY count DESC, s."orgId" ASC
      OFFSET ${by.skip} LIMIT ${by.take}`;
    const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(DISTINCT s."orgId")::bigint AS total
      FROM "ParcelEvent" e JOIN "Shipment" s ON s.id = e."shipmentId"
      WHERE e."toStatus" = ${by.cancelled} AND e.actor = ${by.actor} AND e."createdAt" >= ${by.since}`;
    return { rows: rows.map((r) => ({ orgId: r.orgId, count: Number(r.count) })), total: Number(total) };
  }

  /** The parcel's org, order and units: what payouts reverses when it fails (offers-hardening D1). */
  async reversalScope(id: string, tx: ShipmentDb) {
    return await tx.shipment.findUnique({
      where: { id },
      select: {
        orgId: true,
        orderId: true,
        items: { select: { orderItemId: true, quantity: true } },
      },
    });
  }
}

export const shipmentRepository = new ShipmentRepository();
