import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

/** `prisma`, or the `tx` of the transaction a caller holds. */
type ShipmentDb = Pick<typeof prisma, "shipment" | "shipmentItem">;
type ParcelEventDb = Pick<typeof prisma, "parcelEvent">;

/** Paid in (`paidAfter`, `paidBefore`]; one shop, or one parcel, when named. */
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
      select: { id: true, code: true, orgId: true, fromCity: true, order: { select: { id: true, code: true } } },
    });
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

  async findWithOrder(id: string) {
    return prisma.shipment.findUnique({
      where: { id },
      include: { order: true },
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

  async updateTracking(
    id: string,
    data: { trackingNumber: string; courierName: string; trackingUrl?: string | null },
  ) {
    return prisma.shipment.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
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
    data: { status: string; shipmentStatus?: string; deliveredAt?: Date },
    tx: ShipmentDb,
  ): Promise<boolean> {
    const moved = await tx.shipment.updateMany({ where: { id, status: from }, data });
    return moved.count === 1;
  }

  /** One timeline row, in the transaction that moved the parcel (order-fulfilment D5). */
  async recordEvent(
    data: {
      shipmentId: string; fromStatus: string | null; toStatus: string;
      actor: string; reason?: string | null; courierWording?: string | null;
    },
    tx: ParcelEventDb,
  ): Promise<void> {
    await tx.parcelEvent.create({ data });
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
