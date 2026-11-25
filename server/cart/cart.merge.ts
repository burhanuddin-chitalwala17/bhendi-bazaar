/**
 * The sign-in cart merge, as pure set logic over lines (order-and-cart-lines D6).
 *
 * A line is identified by (productId, size, colour). Union of both carts; where a
 * line exists on both sides, the local (this device's) quantity wins — the buyer is
 * looking at that number as they sign in, so it is the one they mean.
 */

export interface CartLine {
  productId: string;
  quantity: number;
  size?: string | null;
  color?: string | null;
  fromLinkId?: string | null;
}

export function lineKey(line: Pick<CartLine, "productId" | "size" | "color">): string {
  return `${line.productId}::${line.size || ""}::${line.color || ""}`;
}

export function mergeCartLines<L extends CartLine>(localLines: L[], remoteLines: L[]): L[] {
  const merged = new Map<string, L>();
  for (const line of remoteLines) merged.set(lineKey(line), line);
  for (const line of localLines) {
    const existing = merged.get(lineKey(line));
    // A link's mark survives the merge from whichever side holds it (checkout-links D3).
    const kept = existing && { ...existing, quantity: line.quantity, fromLinkId: line.fromLinkId || existing.fromLinkId };
    merged.set(lineKey(line), kept || line);
  }
  return [...merged.values()];
}
