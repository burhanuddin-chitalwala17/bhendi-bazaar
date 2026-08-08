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
}

export function lineKey(line: Pick<CartLine, "productId" | "size" | "color">): string {
  return `${line.productId}::${line.size || ""}::${line.color || ""}`;
}

export function mergeCartLines<L extends CartLine>(localLines: L[], remoteLines: L[]): L[] {
  const merged = new Map<string, L>();
  for (const line of remoteLines) merged.set(lineKey(line), line);
  for (const line of localLines) {
    const existing = merged.get(lineKey(line));
    merged.set(lineKey(line), existing ? { ...existing, quantity: line.quantity } : line);
  }
  return [...merged.values()];
}
