"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

import { DataTable, Column } from "@/components/shared/data-table";
import type { AbandonedCart } from "@/domain/admin";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
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
      phone: "title",
      render: (cart) => cart.userName || "Guest",
    },
    {
      key: "userEmail",
      label: "Email",
      phone: "hidden",
      render: (cart) => <span className="text-muted-foreground">{cart.userEmail}</span>,
    },
    {
      key: "itemsCount",
      label: "Items",
      phone: "meta",
      render: (cart) => `${cart.itemsCount} ${cart.itemsCount === 1 ? "item" : "items"}`,
    },
    {
      key: "totalValue",
      label: "Cart value",
      phone: "meta",
      render: (cart) => <Money paise={cart.totalValue} />,
    },
    {
      key: "daysSinceUpdate",
      label: "Abandoned",
      phone: "meta",
      render: (cart) => (
        <span title={formatShortDate(cart.updatedAt)}>
          {cart.daysSinceUpdate} {cart.daysSinceUpdate === 1 ? "day" : "days"} ago
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      phone: "trailing",
      render: (cart) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelected(cart)}
          aria-label={`View ${cart.userName || "guest"}'s cart`}
        >
          <Icon name="show" />
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        data={carts}
        columns={columns}
        label="Abandoned carts"
        totalPages={totalPages}
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(next) => go({ page: String(next) })}
        onPageSizeChange={(limit) => go({ limit: String(limit), page: "" })}
      />

      {/* The details of one row beside the list it came from: a side panel (ADR-0040 case 3). */}
      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="adaptive">
          {selected && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <SheetTitle>{selected.userName || "Guest"}&apos;s cart</SheetTitle>
                  <SheetDescription>
                    {selected.userEmail || "No email"} · abandoned {selected.daysSinceUpdate}{" "}
                    {selected.daysSinceUpdate === 1 ? "day" : "days"} ago
                  </SheetDescription>
                </div>
                <SheetClose asChild>
                  <Button variant="ghost" shape="icon" aria-label="Close">
                    <Icon name="close" />
                  </Button>
                </SheetClose>
              </div>

              <section className="space-y-2">
                <h3 className="text-small font-semibold text-foreground">
                  {selected.itemsCount} {selected.itemsCount === 1 ? "item" : "items"}
                </h3>
                <ul className="divide-y divide-border rounded-card border border-border">
                  {selected.items.map((item, index) => (
                    <li key={`${item.productId}-${index}`} className="flex items-center gap-3 p-3">
                      <Image
                        src={item.thumbnail}
                        alt={item.productName}
                        width={48}
                        height={64}
                        sizes="48px"
                        className="aspect-[3/4] w-12 rounded-field object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-medium">{item.productName}</p>
                        <p className="text-caption text-muted-foreground">Qty {item.quantity}</p>
                      </div>
                      <p className="text-small font-semibold tabular-nums">
                        {formatCurrency(item.effectivePrice * item.quantity)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-small text-muted-foreground">Cart value</span>
                <span className="text-title font-semibold tabular-nums">
                  <Money paise={selected.totalValue} />
                </span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
