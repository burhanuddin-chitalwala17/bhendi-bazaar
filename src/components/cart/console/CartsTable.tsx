"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Eye, ShoppingCart } from "lucide-react";

import { DataTable, Column } from "@/components/shared/data-table";
import type { AbandonedCart } from "@/domain/admin";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/Money";

interface Props {
  carts: AbandonedCart[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

/**
 * The rows and the detail dialog — what needs a browser here. Paging navigates rather than
 * refetches, because the page above is a server component ([ADR-0034]) and the URL holds the
 * query.
 *
 * **There is no reminder control.** There was one, and it reported "Reminder sent successfully!"
 * over a client method whose whole body was a `console.log` and a `Promise.resolve()` — no route,
 * no template, no send. A control that lies to an operator is worse than an absent one, because
 * the operator stops chasing a cart they believe was chased. Reinstating it means an actual
 * reminder in `server/notifications/`.
 *
 * **Cart value is not sortable**, and the column says so by omission: it is summed in JavaScript
 * from the cart's items, so no `orderBy` can serve it. Marking it sortable offered a sort the
 * server refuses (`tests/integration/sort-vocabularies.test.ts`).
 */
export function CartsTable({ carts, page, pageSize, totalPages, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<AbandonedCart | null>(null);

  const go = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  const columns: Column<AbandonedCart>[] = [
    {
      key: "userName",
      label: "Customer",
      render: (cart) => (
        <div>
          <p className="font-medium">{cart.userName || "Guest"}</p>
          <p className="text-sm text-muted-foreground">{cart.userEmail}</p>
        </div>
      ),
    },
    {
      key: "itemsCount",
      label: "Items",
      render: (cart) => (
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-4 text-muted-foreground/70" />
          <span className="font-semibold">{cart.itemsCount}</span>
        </div>
      ),
    },
    {
      key: "totalValue",
      label: "Cart Value",
      render: (cart) => (
        <span className="font-semibold text-primary"><Money paise={cart.totalValue} /></span>
      ),
    },
    {
      key: "daysSinceUpdate",
      label: "Abandoned",
      render: (cart) => (
        <div>
          <p className="font-medium">
            {cart.daysSinceUpdate} {cart.daysSinceUpdate === 1 ? "day" : "days"} ago
          </p>
          <p className="text-xs text-muted-foreground">
            {formatShortDate(cart.updatedAt)}
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (cart) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelected(cart)}
            className="text-info hover:bg-info/10"
            title="View cart details"
          >
            <Eye className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={carts}
        columns={columns}
        totalPages={totalPages}
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(next) => go({ page: String(next) })}
        onPageSizeChange={(limit) => go({ limit: String(limit), page: "" })}
      />

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 px-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-overlay w-full max-w-2xl overflow-y-auto rounded-lg bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Cart Details</h2>
              <Button
                variant="ghost"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="mb-2 font-semibold text-foreground">Customer</h3>
                <p className="text-sm">
                  <span className="text-muted-foreground">Name:</span> {selected.userName || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Email:</span> {selected.userEmail || "N/A"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Abandoned:</span>{" "}
                  {selected.daysSinceUpdate} days ago
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-foreground">
                  Cart Items ({selected.itemsCount})
                </h3>
                <div className="space-y-2">
                  {selected.items.map((item, index) => (
                    <div
                      key={`${item.productId}-${index}`}
                      className="flex items-center gap-3 rounded-lg bg-background p-3"
                    >
                      <Image
                        src={item.thumbnail}
                        alt={item.productName}
                        width={64}
                        height={85}
                        sizes="64px"
                        className="aspect-[3/4] w-16 rounded object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(item.effectivePrice * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">Total Value:</span>
                  <span className="text-2xl font-bold text-primary">
                    <Money paise={selected.totalValue} />
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelected(null)}
                  className="text-foreground/80 hover:bg-muted/60"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
