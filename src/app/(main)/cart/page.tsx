import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-summary";
import { PageHeader } from "@/components/shared/page-shell";
import { CART_COPY } from "@/components/cart/cart-copy";

export const metadata: Metadata = { title: CART_COPY.pageTitle, robots: { index: false } };

export default function CartPage() {
  return (
    <div className="space-y-4">
      <PageHeader title={CART_COPY.pageTitle} />
      <CartView />
    </div>
  );
}
