"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { ShipmentItem } from "@server/checkout/order.types";
import { SHOP_PARCEL_COPY } from "./parcel-copy";

const FIRST = 5;
const LONG_AT = 30;

/** A parcel's lines; 30 or more show the first five, then "Show all 32 items" (ux.md "Many items"). */
export function ParcelLines({ items }: { items: ShipmentItem[] }) {
  const [all, setAll] = useState(false);
  const long = items.length >= LONG_AT;
  const shown = long && !all ? items.slice(0, FIRST) : items;
  return (
    <div>
      <ul className="divide-y">
        {shown.map((item) => (
          <li key={`${item.productId}-${item.size ?? ""}-${item.color ?? ""}`} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="line-clamp-2 min-w-0 break-words">
              {item.productName}
              {(item.size || item.color) && (
                <span className="text-muted-foreground"> ({[item.size, item.color].filter(Boolean).join(", ")})</span>
              )}
              <span className="text-muted-foreground"> × {item.quantity}</span>
            </span>
            <span className="shrink-0">{formatCurrency((item.salePrice ?? item.price) * item.quantity)}</span>
          </li>
        ))}
      </ul>
      {long && !all && (
        <Button variant="link" className="min-h-10 px-0" onClick={() => setAll(true)}>
          {SHOP_PARCEL_COPY.showAll(items.length)}
        </Button>
      )}
    </div>
  );
}
