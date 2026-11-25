import { randomBytes } from "node:crypto";
import { cartRepository } from "@server/cart/cart.repository";
import { checkoutLinkRepository } from "@server/cart/checkout-link.repository";
import {
  CHECKOUT_LINK_TTL_MS,
  createCheckoutLinkInput,
  type CheckoutLinkItem,
  type CheckoutLinkResolution,
  type CreateCheckoutLinkInput,
  type CreatedCheckoutLink,
  type OpenCheckoutLinkResult,
} from "@server/cart/checkout-link.types";
import { lockedAmong } from "@server/bidding/bidding-lock";
import { DomainError } from "@server/shared/domain-error";
import { appUrl } from "@server/shared/app-url";
import { ROUTES } from "@server/shared/routes";

/**
 * Checkout links (checkout-links trd.md): made by inbox, automations and campaigns; opened by a
 * buyer. A link holds products and quantities only, so whatever it shows is priced today (ADR-0002).
 */
export class CheckoutLinkService {
  async create(input: CreateCheckoutLinkInput, now: Date = new Date()): Promise<CreatedCheckoutLink> {
    const parsed = createCheckoutLinkInput.safeParse(input);
    if (!parsed.success) throw new DomainError("A checkout link needs one to twenty products, each with a quantity from 1 to 99.");
    const { orgId, items, source, sourceRef } = parsed.data;
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      throw new DomainError("A checkout link names each product once.");
    }

    const [preview, locked] = await Promise.all([
      cartRepository.previewLines(items),
      lockedAmong(items.map((item) => item.productId), now),
    ]);
    const sellable = preview.filter((p) => p.onSale && !locked.has(p.line.productId) && p.line.org.id === orgId);
    if (sellable.length !== items.length) {
      throw new DomainError("A checkout link can only hold this shop's products that are on sale.");
    }

    const link = await checkoutLinkRepository.create({
      token: randomBytes(16).toString("base64url"),
      orgId,
      items,
      source,
      sourceRef: sourceRef ?? null,
      // For "was ₹y when sent" only; nothing ever charges it (D4).
      displayPricesPaise: Object.fromEntries(sellable.map(({ line }) => [line.productId, line.salePrice ?? line.price])),
      expiresAt: new Date(now.getTime() + CHECKOUT_LINK_TTL_MS),
    });
    return {
      id: link.id,
      token: link.token,
      url: `${appUrl()}${ROUTES.checkoutLink(link.orgHandle, link.token)}`,
      expiresAt: link.expiresAt,
    };
  }

  /** What an address resolves to, adding nothing: the opener page's first question. */
  async resolve(shopHandle: string, token: string, now: Date = new Date()): Promise<CheckoutLinkResolution> {
    const link = await this.find(shopHandle, token);
    if (!link) return { kind: "unknown" };
    if (link.expiresAt <= now) return { kind: "expired", productSlug: await this.firstOnSaleSlug(link.items) };
    return { kind: "live", linkId: link.id };
  }

  /**
   * Open a link for one cart: the lines to add, today's prices, anything unavailable left out by
   * name. The claim comes last, so a failure before it leaves the link openable (D3).
   */
  async open(shopHandle: string, token: string, cartKey: string, now: Date = new Date()): Promise<OpenCheckoutLinkResult> {
    const link = await this.find(shopHandle, token);
    if (!link) return { kind: "unknown" };
    if (link.expiresAt <= now) return { kind: "expired", productSlug: await this.firstOnSaleSlug(link.items) };

    const [preview, locked] = await Promise.all([
      cartRepository.previewLines(link.items, link.id),
      lockedAmong(link.items.map((item) => item.productId), now),
    ]);
    const addable = (p: (typeof preview)[number]) =>
      p.onSale && !locked.has(p.line.productId) && p.onHand >= p.line.quantity;
    const lines = preview.filter(addable).map((p) => p.line);
    const leftOut = preview
      .filter((p) => !addable(p))
      .map((p) => ({ productId: p.line.productId, productName: p.line.productName }));

    const claimed = await checkoutLinkRepository.claimOpen(link.id, cartKey);
    if (!claimed) return { kind: "opened", linkId: link.id, alreadyOpened: true, lines: [], leftOut: [] };
    return { kind: "opened", linkId: link.id, alreadyOpened: false, lines, leftOut };
  }

  private find(shopHandle: string, token: string) {
    return checkoutLinkRepository.findByShopAndToken(shopHandle, token);
  }

  private async firstOnSaleSlug(items: CheckoutLinkItem[]): Promise<string | null> {
    const preview = await cartRepository.previewLines(items);
    return preview.find((p) => p.onSale)?.line.productSlug ?? null;
  }
}

export const checkoutLinkService = new CheckoutLinkService();
