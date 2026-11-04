import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SHOP_ORDERS_COPY } from "./parcel-copy";

/** ux.md "Shop orders", Refused: not a member of this shop. */
export function ShopOrdersRefused() {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border bg-card p-6 text-small">
      <p>{SHOP_ORDERS_COPY.refused}</p>
      <Button asChild variant="outline" className="min-h-10">
        <Link href="/org">{SHOP_ORDERS_COPY.goToMyShops}</Link>
      </Button>
    </div>
  );
}
