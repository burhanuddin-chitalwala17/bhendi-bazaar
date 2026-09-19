import { CartLineItems } from "@/components/cart/cart-line-items";
import { CartSummary } from "@/components/cart/cart-summary";
import { SectionHeader } from "@/components/shared/SectionHeader";

export default function CartPage() {
  return (
    <div className="space-y-6">
      <SectionHeader overline="Your selection from the bazaar" title="Cart" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
        <CartLineItems />
        <CartSummary />
      </div>
    </div>
  );
}
