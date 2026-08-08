import { OrderSummary } from "@/components/order/order-summary";
import { SectionHeader } from "../shared/SectionHeader";
import { Order } from "@/domain/order";

interface OrderClientProps {
  order: Order;
}

export function OrderClient({ order }: OrderClientProps) {

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <SectionHeader
          overline="Order"
          title="Thank you for shopping at Bhendi Bazaar"
          description="Your order has been placed successfully."
        />
      </header>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <OrderSummary order={order} showShare={true} />
      </div>
    </div>
  );
}


