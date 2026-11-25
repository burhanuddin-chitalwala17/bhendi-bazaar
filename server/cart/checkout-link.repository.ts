import { prisma } from "@server/shared/prisma";
import { createCheckoutLinkInput, type CheckoutLinkItem, type CheckoutLinkSource } from "@server/cart/checkout-link.types";

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
        items: data.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
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
  ): Promise<{ id: string; items: CheckoutLinkItem[]; expiresAt: Date } | null> {
    const link = await prisma.checkoutLink.findFirst({
      where: { token, org: { handle: shopHandle } },
      select: { id: true, items: true, expiresAt: true },
    });
    if (!link) return null;
    return { id: link.id, items: createCheckoutLinkInput.shape.items.parse(link.items), expiresAt: link.expiresAt };
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

export const checkoutLinkRepository = new CheckoutLinkRepository();
