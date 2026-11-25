import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkoutLinksDAL } from "@/data-access-layer/checkout-links.dal";
import { CheckoutLinkOpener } from "@/components/cart/checkout-link/CheckoutLinkOpener";
import { CHECKOUT_LINK_COPY } from "@/components/cart/checkout-link/checkout-link-copy";
import { ROUTES } from "@server/shared/routes";

// A link is one buyer's; nothing here is for a search engine.
export const metadata: Metadata = { title: CHECKOUT_LINK_COPY.pageTitle, robots: { index: false, follow: false } };

interface CheckoutLinkPageProps {
  params: Promise<{ shop: string; token: string }>;
}

/** A link from a chat (checkout-links D2, D3): edited → the shop, expired → its product, else add and check out. */
export default async function CheckoutLinkPage({ params }: CheckoutLinkPageProps) {
  const { shop, token } = await params;
  const link = await checkoutLinksDAL.resolve(shop, token);
  if (link.kind === "unknown") redirect(ROUTES.store(shop));
  if (link.kind === "expired") {
    redirect(link.productSlug ? ROUTES.productFromExpiredLink(link.productSlug) : ROUTES.store(shop));
  }
  return <CheckoutLinkOpener shop={shop} token={token} />;
}
