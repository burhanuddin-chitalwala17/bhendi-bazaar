import type { Order } from "@/domain/order";
import { PriceDisplay } from "../shared/PriceDisplay";
import { ShareButton } from "../shared/ShareButton";
import { DownloadBillButton } from "./download-bill-button";
import { PAYMENT_STATUS } from "@server/checkout/order.types";
import { ORDER_SUMMARY_COPY } from "./order-copy";
import { ROUTES } from "@server/shared/routes";
import { ORDER_SHARE_COPY } from "@/components/order/order-copy";

interface OrderSummaryProps {
  order: Order;
  showShare?: boolean;
}

export function OrderSummary({ order, showShare = false }: OrderSummaryProps) {
  const paymentLabel =
    order.paymentMethod && order.paymentStatus
      ? `${order.paymentMethod === "razorpay" ? ORDER_SUMMARY_COPY.razorpay : ORDER_SUMMARY_COPY.stripe} · ${
          order.paymentStatus === PAYMENT_STATUS.PAID
            ? ORDER_SUMMARY_COPY.paid
            : order.paymentStatus === PAYMENT_STATUS.FAILED
              ? ORDER_SUMMARY_COPY.failed
              : ORDER_SUMMARY_COPY.pending
        }`
      : null;

  const allItems = order.shipments.flatMap((shipment) => shipment.items);

  return (
    <section className="bill-print space-y-3 rounded-card border border-border bg-card p-4 text-small">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-title font-semibold">Bill · {order.code}</h2>
          {paymentLabel && <p className="text-caption text-muted-foreground">{paymentLabel}</p>}
        </div>
        <div className="flex items-center gap-1">
          {showShare && (
            <>
              <DownloadBillButton className="print:hidden" />
              <ShareButton
                url={ROUTES.order(order.id)}
                title={ORDER_SHARE_COPY.title(order.code)}
                text={ORDER_SHARE_COPY.text}
                variant="ghost"
                size="lg"
                shape="icon"
                showLabel={false}
                className="print:hidden"
              />
            </>
          )}
        </div>
      </header>
      <div className="space-y-1">
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
      <div className="mt-2 space-y-1 border-t border-border pt-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{ORDER_SUMMARY_COPY.subtotal}</span>
          <PriceDisplay price={order.itemsTotal} size="sm" />
        </div>
        {order.shippingTotal > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{ORDER_SUMMARY_COPY.delivery}</span>
            <PriceDisplay price={order.shippingTotal} size="sm" />
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{ORDER_SUMMARY_COPY.offers}</span>
            <PriceDisplay price={order.discount} size="sm" />
          </div>
        )}
        <div className="mt-1 flex items-center justify-between text-body font-semibold">
          <span>{ORDER_SUMMARY_COPY.total}</span>
          <PriceDisplay price={order.grandTotal} size="sm" />
        </div>
      </div>
    </section>
  );
}
