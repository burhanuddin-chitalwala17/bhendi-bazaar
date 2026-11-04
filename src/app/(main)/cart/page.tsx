import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-summary";
import { PageHeader } from "@/components/shared/page-shell";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Your bag" />
      <CartView />
    </div>
  );
}
