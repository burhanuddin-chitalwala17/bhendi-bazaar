/**
 * The checkout made for one auction winner (winner-offer R14–R17).
 *
 * One line, the auctioned option, quantity one, at the bid. The price shown here is display
 * only: the order transaction reads it again from the offer the token names (ADR-0041), and
 * refuses a total that disagrees. Reachable only while the offer is accepted and unexpired;
 * anything else goes back to the offer page, which says why.
 */
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { offerService } from "@server/bidding/offer.service";
import { NotFoundError } from "@server/shared/domain-error";
import { productsDAL } from "@/data-access-layer/products.dal";
import { CheckoutContainer } from "@/components/checkout";
import { SectionHeader } from "@/components/shared/SectionHeader";
import type { CartItem } from "@/domain/cart";

export const metadata: Metadata = {
  title: "Pay for your auction win",
  robots: { index: false, follow: false },
};

export default async function AuctionCheckoutPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const offer = await offerService.view(token).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!offer) notFound();
  if (offer.state !== "accepted" || !offer.expiresAt) redirect(`/bid-offer/${token}`);

  const product = await productsDAL.getProductBySlug(offer.product.slug);
  const item: CartItem = {
    // Stable per offer, so a re-render is the same line rather than a new one.
    id: `auction-${offer.product.id}`,
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    thumbnail: product.thumbnail,
    price: offer.amountPaise,
    quantity: 1,
    size: offer.size ?? undefined,
    color: offer.color ?? undefined,
    weight: product.weight,
    shippingFromPincode: product.shippingFromPincode,
    org: product.org,
  };

  return (
    <div className="space-y-6">
      <SectionHeader overline="Auction checkout" title="Pay for the item you won" />
      <CheckoutContainer
        buyNowProduct={item}
        auction={{
          token,
          expiresAt: offer.expiresAt.toISOString(),
          serverNow: offer.serverNow.toISOString(),
        }}
      />
    </div>
  );
}
