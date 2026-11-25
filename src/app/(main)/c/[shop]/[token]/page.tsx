import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { checkoutLinksDAL } from "@/data-access-layer/checkout-links.dal";
import { CheckoutLinkOpener } from "@/components/cart/checkout-link/CheckoutLinkOpener";
import { CheckoutLinkSizeStep } from "@/components/cart/checkout-link/CheckoutLinkSizeStep";
import { CHECKOUT_LINK_COPY } from "@/components/cart/checkout-link/checkout-link-copy";
import { ROUTES } from "@server/shared/routes";

// A link is one buyer's; nothing here is for a search engine.
export const metadata: Metadata = { title: CHECKOUT_LINK_COPY.pageTitle, robots: { index: false, follow: false } };

interface CheckoutLinkPageProps {
  params: Promise<{ shop: string; token: string }>;
  searchParams?: Promise<{ size?: string | string[] }>;
}

/**
 * A link from a chat (checkout-links D2, D3, D6): edited → the shop, expired → its product, a size
 * still to pick → the size step, else add and check out.
 */
export default async function CheckoutLinkPage({ params, searchParams }: CheckoutLinkPageProps) {
  const { shop, token } = await params;
  const link = await checkoutLinksDAL.resolve(shop, token);
  if (link.kind === "unknown") redirect(ROUTES.store(shop));
  if (link.kind === "expired") {
    redirect(link.productSlug ? ROUTES.productFromExpiredLink(link.productSlug) : ROUTES.store(shop));
  }
  const picked = [(await searchParams)?.size ?? []].flat();
  const step = link.sizeSteps.find((s) => !s.options.some((option) => picked.includes(option.productId)));
  if (step) return <CheckoutLinkSizeStep shop={shop} token={token} picked={picked} step={step} />;
  return <CheckoutLinkOpener shop={shop} token={token} sizes={picked} />;
}
