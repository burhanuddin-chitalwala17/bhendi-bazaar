import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { cartRepository, type PreviewLine } from "@server/cart/cart.repository";
import { checkoutLinkRepository } from "@server/cart/checkout-link.repository";
import {
  CHECKOUT_LINK_TTL_MS,
  createCheckoutLinkInput,
  type CheckoutLinkItem,
  type CheckoutLinkNote,
  type CheckoutLinkNotesRequest,
  type CheckoutLinkResolution,
  type CreateCheckoutLinkInput,
  type CreatedCheckoutLink,
  type OpenCheckoutLinkResult,
  type OrderLinkMark,
  type SizeStep,
} from "@server/cart/checkout-link.types";
import { lockedAmong } from "@server/bidding/bidding-lock";
import { DomainError } from "@server/shared/domain-error";
import { appUrl } from "@server/shared/app-url";
import { ROUTES } from "@server/shared/routes";

/** On sale, not held by an auction, and in stock at the asked quantity: what a link may add (Q5). */
function addable(p: PreviewLine, locked: ReadonlySet<string>, orgId: string): boolean {
  return p.onSale && !locked.has(p.line.productId) && p.line.org.id === orgId && p.onHand >= p.line.quantity;
}

const todaysPrice = (p: PreviewLine) => p.line.salePrice ?? p.line.price;

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
    // A size the buyer will pick is priced too, so its "was ₹y" is that size's own (D4, D6).
    const families = await cartRepository.familyMembersOf(items.filter((i) => i.pickSize).map((i) => i.productId));
    const sizes = await cartRepository.previewLines(
      [...families.values()].flat().map((productId) => ({ productId, quantity: 1 })),
    );

    const link = await checkoutLinkRepository.create({
      token: randomBytes(16).toString("base64url"),
      orgId,
      items,
      source,
      sourceRef: sourceRef ?? null,
      // For "was ₹y when sent" only; nothing ever charges it (D4).
      displayPricesPaise: Object.fromEntries(
        [...sizes, ...sellable].filter((p) => p.line.org.id === orgId).map((p) => [p.line.productId, todaysPrice(p)]),
      ),
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
    return { kind: "live", linkId: link.id, sizeSteps: await this.sizeSteps(link.items, link.orgId, now) };
  }

  /**
   * Open a link for one cart: the lines to add, today's prices, anything unavailable left out by
   * name. `sizes` are the buyer's picks on the size step (D6). The claim comes last, so a failure
   * before it leaves the link openable (D3), and nothing to add claims nothing, so a link whose
   * items are all gone still works once they are back.
   */
  async open(
    shopHandle: string,
    token: string,
    cartKey: string,
    now: Date = new Date(),
    sizes: readonly string[] = [],
  ): Promise<OpenCheckoutLinkResult> {
    const link = await this.find(shopHandle, token);
    if (!link) return { kind: "unknown" };
    if (link.expiresAt <= now) return { kind: "expired", productSlug: await this.firstOnSaleSlug(link.items) };

    const steps = new Map((await this.sizeSteps(link.items, link.orgId, now)).map((step) => [step.productId, step]));
    // Only a size the step offered: a pick is a choice among this family's sizes, never any product.
    const items = link.items.map((item) => {
      const picked = steps.get(item.productId)?.options.find((option) => sizes.includes(option.productId));
      return picked ? { productId: picked.productId, quantity: item.quantity } : item;
    });

    const [preview, locked] = await Promise.all([
      cartRepository.previewLines(items, link.id),
      lockedAmong(items.map((item) => item.productId), now),
    ]);
    const lines = preview.filter((p) => addable(p, locked, link.orgId)).map((p) => p.line);
    const leftOut = preview
      .filter((p) => !addable(p, locked, link.orgId))
      .map((p) => ({ productId: p.line.productId, productName: p.line.productName }));
    if (lines.length === 0) return { kind: "opened", linkId: link.id, alreadyOpened: false, lines, leftOut };

    const claimed = await checkoutLinkRepository.claimOpen(link.id, cartKey);
    if (!claimed) return { kind: "opened", linkId: link.id, alreadyOpened: true, lines: [], leftOut: [] };
    return { kind: "opened", linkId: link.id, alreadyOpened: false, lines, leftOut };
  }

  /**
   * What checkout says about each link its lines came from (D4): the shop, the items left out, and
   * the prices that moved. Recomputed from the link's own items (decisions Q4, Q7): an item counts as
   * left out only when it is not in this checkout and could not be added now, so a line the buyer
   * removed is not reported as out of stock.
   */
  async notes(requests: readonly CheckoutLinkNotesRequest[], now: Date = new Date()): Promise<CheckoutLinkNote[]> {
    const links = await checkoutLinkRepository.findForNotes([...new Set(requests.map((r) => r.linkId))]);
    return Promise.all(
      links.map(async (link) => {
        const held = new Set(requests.filter((r) => r.linkId === link.id).flatMap((r) => r.productIds));
        const families = await cartRepository.familyMembersOf(link.items.filter((i) => i.pickSize).map((i) => i.productId));
        const candidates = (item: CheckoutLinkItem) => (item.pickSize ? (families.get(item.productId) ?? [item.productId]) : [item.productId]);

        const wanted = link.items.flatMap((item) => candidates(item).map((productId) => ({ productId, quantity: item.quantity })));
        const [preview, locked] = await Promise.all([
          cartRepository.previewLines(wanted),
          lockedAmong(wanted.map((w) => w.productId), now),
        ]);
        const canAdd = new Set(preview.filter((p) => addable(p, locked, link.orgId)).map((p) => p.line.productId));
        const names = new Map(preview.map((p) => [p.line.productId, p.line.productName]));
        const price = new Map(preview.map((p) => [p.line.productId, todaysPrice(p)]));

        const leftOut = link.items
          .filter((item) => candidates(item).every((id) => !held.has(id) && !canAdd.has(id)))
          .flatMap((item) => {
            const productName = names.get(item.productId);
            return productName ? [{ productId: item.productId, productName }] : [];
          });
        const priceChanges = [...held].flatMap((productId) => {
          const wasPaise = link.displayPricesPaise[productId];
          const nowPaise = price.get(productId);
          return wasPaise !== undefined && nowPaise !== undefined && nowPaise !== wasPaise ? [{ productId, nowPaise, wasPaise }] : [];
        });
        return { linkId: link.id, shopName: link.shopName, shopHandle: link.shopHandle, leftOut, priceChanges };
      }),
    );
  }

  /** The order these links' lines became, recorded in the order's own transaction (D5). */
  async recordOrderIn(tx: Prisma.TransactionClient, orderId: string, marks: readonly OrderLinkMark[]): Promise<void> {
    if (marks.length === 0) return;
    // A mark is the browser's word: only a line holding one of the link's own products (or a size of one) counts.
    const links = await checkoutLinkRepository.itemsIn(tx, [...new Set(marks.map((m) => m.linkId))]);
    const items = [...links.values()].flat();
    const families = await cartRepository.familyMembersOf(items.filter((i) => i.pickSize).map((i) => i.productId));
    const holds = (linkId: string, productId: string) =>
      (links.get(linkId) ?? []).some((item) =>
        item.pickSize ? (families.get(item.productId) ?? [item.productId]).includes(productId) : item.productId === productId,
      );
    const real = marks.filter((mark) => holds(mark.linkId, mark.productId));
    if (real.length > 0) await checkoutLinkRepository.recordOrderIn(tx, orderId, real);
  }

  /** A family item's sizes the buyer may pick now; an item with none to pick has no step (D6). */
  private async sizeSteps(items: readonly CheckoutLinkItem[], orgId: string, now: Date): Promise<SizeStep[]> {
    const picks = items.filter((item) => item.pickSize);
    if (picks.length === 0) return [];
    const families = await cartRepository.familyMembersOf(picks.map((item) => item.productId));
    const steps = await Promise.all(
      picks.map(async (item) => {
        const members = families.get(item.productId) ?? [];
        // One product is not a choice of sizes: no step, the item opens as it is.
        if (members.length < 2) return { productId: item.productId, options: [] };
        const [preview, locked] = await Promise.all([
          cartRepository.previewLines(members.map((productId) => ({ productId, quantity: item.quantity }))),
          lockedAmong(members, now),
        ]);
        const options = preview
          .filter((p) => addable(p, locked, orgId))
          .map((p) => ({ productId: p.line.productId, name: p.line.productName, thumbnail: p.line.thumbnail }));
        return { productId: item.productId, options };
      }),
    );
    return steps.filter((step) => step.options.length > 0);
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
