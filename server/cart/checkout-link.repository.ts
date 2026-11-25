import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { PAYMENT_STATUS } from "@server/checkout/order.types";
import {
  createCheckoutLinkInput,
  type CheckoutLinkItem,
  type CheckoutLinkSource,
  type OrderLinkMark,
} from "@server/cart/checkout-link.types";

const parseItems = (items: unknown): CheckoutLinkItem[] => createCheckoutLinkInput.shape.items.parse(items);

/** The only place `CheckoutLink` and `CheckoutLinkOpen` are written (Invariant 5). */
export class CheckoutLinkRepository {
  async create(data: {
    token: string;
    orgId: string;
    items: CheckoutLinkItem[];
    source: CheckoutLinkSource;
    sourceRef: string | null;
    displayPricesPaise: Record<string, number>;
    expiresAt: Date;
  }): Promise<{ id: string; token: string; expiresAt: Date; orgHandle: string }> {
    const link = await prisma.checkoutLink.create({
      data: {
        token: data.token,
        orgId: data.orgId,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          ...(item.pickSize ? { pickSize: true } : {}),
        })),
        source: data.source,
        sourceRef: data.sourceRef,
        displayPricesPaise: data.displayPricesPaise,
        expiresAt: data.expiresAt,
      },
      select: { id: true, token: true, expiresAt: true, org: { select: { handle: true } } },
    });
    return { id: link.id, token: link.token, expiresAt: link.expiresAt, orgHandle: link.org.handle };
  }

  /** The link only when the token and the shop agree: either edited finds nothing (D2). */
  async findByShopAndToken(
    shopHandle: string,
    token: string,
  ): Promise<{ id: string; orgId: string; items: CheckoutLinkItem[]; expiresAt: Date } | null> {
    const link = await prisma.checkoutLink.findFirst({
      where: { token, org: { handle: shopHandle } },
      select: { id: true, orgId: true, items: true, expiresAt: true },
    });
    if (!link) return null;
    return { id: link.id, orgId: link.orgId, items: parseItems(link.items), expiresAt: link.expiresAt };
  }

  /** What checkout's note on a link is worked out from (D4). */
  async findForNotes(ids: readonly string[]): Promise<
    Array<{ id: string; orgId: string; items: CheckoutLinkItem[]; displayPricesPaise: Record<string, number>; shopName: string; shopHandle: string }>
  > {
    if (ids.length === 0) return [];
    const links = await prisma.checkoutLink.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, orgId: true, items: true, displayPricesPaise: true, org: { select: { name: true, handle: true } } },
    });
    return links.map((link) => ({
      id: link.id,
      orgId: link.orgId,
      items: parseItems(link.items),
      displayPricesPaise: toPaiseRecord(link.displayPricesPaise),
      shopName: link.org.name,
      shopHandle: link.org.handle,
    }));
  }

  /** What these links hold, read in the order's transaction (D5). */
  async itemsIn(tx: Prisma.TransactionClient, ids: readonly string[]): Promise<Map<string, CheckoutLinkItem[]>> {
    const links = await tx.checkoutLink.findMany({ where: { id: { in: [...ids] } }, select: { id: true, items: true } });
    return new Map(links.map((link) => [link.id, parseItems(link.items)]));
  }

  /**
   * Record the order a link became, inside the order's transaction (D5). Only a link of the shop the
   * line was bought from, and never over an order already paid: a retried Pay makes a new order.
   */
  async recordOrderIn(tx: Prisma.TransactionClient, orderId: string, marks: readonly OrderLinkMark[]): Promise<void> {
    const byOrg = new Map<string, string[]>();
    for (const mark of marks) byOrg.set(mark.orgId, [...(byOrg.get(mark.orgId) ?? []), mark.linkId]);
    for (const [orgId, ids] of byOrg) {
      await tx.checkoutLink.updateMany({
        where: {
          id: { in: [...new Set(ids)] },
          orgId,
          OR: [{ orderId: null }, { order: { paymentStatus: { not: PAYMENT_STATUS.PAID } } }],
        },
        data: { orderId },
      });
    }
  }

  /** Which of these link ids exist: a cart line's mark naming none is dropped, not stored. */
  async existingIds(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await prisma.checkoutLink.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
    return new Set(rows.map((row) => row.id));
  }

  /** Claim this link for this cart. True the first time only: the unique row is the guard (D3). */
  async claimOpen(linkId: string, cartKey: string): Promise<boolean> {
    const { count } = await prisma.checkoutLinkOpen.createMany({
      data: [{ linkId, cartKey }],
      skipDuplicates: true,
    });
    return count === 1;
  }
}

function toPaiseRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, number] => Number.isInteger(entry[1])),
  );
}

export const checkoutLinkRepository = new CheckoutLinkRepository();
