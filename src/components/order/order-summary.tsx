import type { Order } from "@/domain/order";
import { SectionHeader } from "../shared/SectionHeader";
import { PriceDisplay } from "../shared/PriceDisplay";
import { ShareButton } from "../shared/ShareButton";

interface OrderSummaryProps {
  order: Order;
  showShare?: boolean;
}

export function OrderSummary({ order, showShare = false }: OrderSummaryProps) {
  const paymentLabel =
    order.paymentMethod && order.paymentStatus
      ? `${order.paymentMethod === "razorpay" ? "Razorpay" : "Stripe"} · ${
          order.paymentStatus === "paid"
            ? "Paid"
            : order.paymentStatus === "failed"
            ? "Failed"
            : "Pending"
        }`
      : null;

  // Flatten all items from all shipments
  const allItems = order.shipments.flatMap((shipment) => shipment.items);

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-card/80 p-4 text-sm">
      <header className="flex items-baseline justify-between gap-2">
        <div className="flex-1">
          <SectionHeader
            overline="Bill summary"
            title={`Order ${order.code}`}
          />
        </div>
        <div className="flex items-center gap-2">
          {paymentLabel && (
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-primary">
              {paymentLabel}
            </p>
          )}
          {showShare && (
            <ShareButton
              url={`${
                typeof window !== "undefined" ? window.location.origin : ""
              }/order/${order.id}`}
              title={`Order ${order.code} - Bhendi Bazaar`}
              text={`Check out my order from Bhendi Bazaar`}
              variant="ghost"
              size="icon"
              showLabel={false}
              className="h-7 w-7"
            />
          )}
        </div>
      </header>
      <div className="space-y-1 text-xs">
        {allItems.map((item, index) => (
          <div
            key={`${item.productId}-${index}`}
            className="flex items-baseline justify-between gap-2"
          >
            <span className="line-clamp-1 text-muted-foreground">
              {item.productName} × {item.quantity}
            </span>
            <span>
              <PriceDisplay
                price={item.price}
                salePrice={item.salePrice}
                size="sm"
              />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1 border-t border-dashed border-border/70 pt-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <PriceDisplay price={order.itemsTotal} size="sm" />
        </div>
        {order.shippingTotal > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Shipping</span>
            <PriceDisplay price={order.shippingTotal} size="sm" />
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Savings</span>
            <PriceDisplay price={order.discount} size="sm" />
          </div>
        )}
        <div className="mt-1 flex items-center justify-between text-sm font-semibold">
          <span>Total</span>
          <PriceDisplay price={order.grandTotal} size="sm" />
        </div>
      </div>
    </section>
  );
}
