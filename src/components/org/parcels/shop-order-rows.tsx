"use client";

import Image from "next/image";
import { ResourceList, type ResourceColumn } from "@/components/shared/resource-list";
import { StatusBadge, type StatusTone } from "@/components/shared/badges/StatusBadge";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { SHIPMENT_STATUS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import type { ShopOrderView, ShopParcelView } from "@server/checkout/shop-parcel.types";
import { SHOP_ORDERS_COPY, parcelOfLine } from "./parcel-copy";
import { ReadyForPickup } from "./ready-for-pickup";
import { SHOP_ORDER_COLUMN_COPY } from "@/components/org/parcels/parcel-copy";

type Row = { order: ShopOrderView; parcel: ShopParcelView; href: string };

/** Packing waits on the shop; a problem in transit is ours to chase; the rest are informative. */
const TONE: Partial<Record<ShipmentStatus, StatusTone>> = {
  [SHIPMENT_STATUS.PACKING]: "warning",
  [SHIPMENT_STATUS.DELIVERED]: "success",
  [SHIPMENT_STATUS.CANCELLED]: "neutral",
  [SHIPMENT_STATUS.LOST]: "destructive",
  [SHIPMENT_STATUS.DAMAGED]: "destructive",
};

/**
 * One row per parcel (ux.md "Shop orders", Partial): "Parcel 1 of 2 · To pack", the buyer as name,
 * city and pincode (Q22). Rows on a phone, a table from a tablet. A parcel still packing carries
 * "Mark packed" on its row (only where the shop itself is looking: `orgId`), the same act as the
 * parcel page's "Ready for pickup".
 */
export function ShopOrderRows({ rows, orgId }: { rows: Row[]; orgId?: string }) {
  const columns: ResourceColumn<Row>[] = [
    { key: "order", label: "Order", phone: "title", cell: ({ order }) => order.code },
    // How long the buyer has waited is what "To pack" is sorted by; the row says it (the shop Orders prototype).
    {
      key: "paid",
      label: "Paid",
      phone: "meta",
      cell: ({ parcel }) => (parcel.paidAt ? `${formatDate(parcel.paidAt, { day: "numeric", month: "short" })}, ${formatTime(parcel.paidAt)}` : "—"),
    },
    {
      key: "items",
      label: "Items",
      cell: ({ parcel }) => <span className="line-clamp-2 whitespace-normal break-words">{parcel.items.map((i) => i.productName).join(", ")}</span>,
    },
    { key: "buyer", label: "Buyer", cell: ({ order }) => `${order.buyer.name} · ${order.buyer.city}, ${order.buyer.pincode}` },
    { key: "value", label: SHOP_ORDER_COLUMN_COPY.value, align: "end", phone: "meta", cell: ({ parcel }) => formatCurrency(parcel.parcelValue) },
    {
      key: "status",
      label: "Parcel",
      phone: "meta",
      cell: ({ parcel }) => (
        <StatusBadge tone={TONE[parcel.status] ?? "info"} dot>
          {parcelOfLine(parcel.position, parcel.ofCount, parcel.status)}
        </StatusBadge>
      ),
    },
    {
      key: "action",
      label: "Action",
      phone: "trailing",
      cell: ({ parcel }) =>
        orgId && parcel.status === SHIPMENT_STATUS.PACKING ? (
          <ReadyForPickup orgId={orgId} shipmentId={parcel.id} firstOrder={false} docked={false} label={SHOP_ORDERS_COPY.markPacked} />
        ) : null,
    },
  ];

  return (
    <ResourceList
      label={SHOP_ORDERS_COPY.parcels}
      rows={rows}
      rowKey={({ parcel }) => parcel.id}
      rowLabel={({ order }) => order.code}
      columns={columns}
      rowHref={({ href }) => href}
      thumbnail={({ parcel }) =>
        parcel.items[0]?.thumbnail ? (
          <Image src={parcel.items[0].thumbnail} alt="" width={44} height={55} sizes="44px" className="aspect-4/5 w-11 rounded-field object-cover" />
        ) : null
      }
    />
  );
}
