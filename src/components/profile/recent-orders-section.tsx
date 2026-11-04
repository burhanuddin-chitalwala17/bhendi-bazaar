import type { Order } from "@/domain/order";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import { SectionHeader } from "../shared/SectionHeader";
import { PriceDisplay } from "../shared/PriceDisplay";
import { formatDate } from "@/lib/format";
import { RECENT_ORDERS_SECTION_COPY } from "./profile-copy";
import { ROUTES } from "@server/shared/routes";

interface RecentOrdersSectionProps {
  orders: Order[];
}

export function RecentOrdersSection({ orders }: RecentOrdersSectionProps) {
  return (
    <Card>
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-center justify-between gap-3">
          <SectionHeader
            overline={RECENT_ORDERS_SECTION_COPY.lastFewOrdersBrowser}
            title={RECENT_ORDERS_SECTION_COPY.recentOrders}
            action={{
              label: RECENT_ORDERS_SECTION_COPY.viewAll,
              href: ROUTES.orders,
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{RECENT_ORDERS_SECTION_COPY.havenTPlacedAny}</p>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <Link
                prefetch={false}
                key={order.id}
                href={ROUTES.order(order.id)}
                className="flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-card/80 p-3 text-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <p className="font-semibold">
                    {order.code} ·{" "}
                    {formatDate(order.createdAt, {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {order.address.addressLine1} · {order.shipments.length}{" "}
                    items
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <PriceDisplay price={order.grandTotal} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
