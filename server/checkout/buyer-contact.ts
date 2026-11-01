import type { Prisma } from "@prisma/client";
import { orderRepository } from "@server/checkout/order.repository";
import { profileService } from "@server/identity/profile.service";

/**
 * The buyer's email: the address snapshot's, else the account's login email. The address book's
 * email is usually blank, so the fallback is what reaches a signed-in buyer at all.
 */
export async function resolveBuyerEmail(address: unknown, userId: string | null): Promise<string | null> {
  const fromAddress =
    address && typeof address === "object" && "email" in address && typeof address.email === "string" ? address.email : "";
  if (fromAddress) return fromAddress;
  return userId ? await profileService.findLoginEmail(userId) : null;
}

/** The same, for an order by id, on the caller's transaction (order-fulfilment R6). */
export async function buyerEmailOf(orderId: string, tx: Prisma.TransactionClient): Promise<string | null> {
  const order = await orderRepository.contactOf(orderId, tx);
  return order ? await resolveBuyerEmail(order.address, order.userId) : null;
}
