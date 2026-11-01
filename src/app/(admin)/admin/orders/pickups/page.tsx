import Link from "next/link";

import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import { pickupsDAL } from "@/data-access-layer/admin/pickups.dal";
import { NotPackedList } from "@/components/order/pickups/not-packed-list";
import { NOT_PACKED_COPY } from "@/components/order/pickups/pickups-copy";

export const metadata = { title: "Pickups", robots: { index: false, follow: false } };

/**
 * The admin's pickup queue. Unit 2 brings its "Not packed" tab (order-fulfilment R3a, A11):
 * paid parcels not marked ready 36 h on, oldest first, filterable by shop. Ready and Booked join in unit 3.
 */
export default async function AdminPickupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const shop = typeof params.shop === "string" ? params.shop : undefined;
  const now = Date.now();
  const [rows, count] = await Promise.all([pickupsDAL.notPacked(shop), pickupsDAL.notPackedCount(shop)]);

  return (
    <div className="space-y-4">
      <SectionHeader as="h1" title={NOT_PACKED_COPY.title} />
      <nav className="flex gap-2" aria-label="Pickups">
        <Button asChild size="sm" className="min-h-10">
          <Link href="/admin/orders/pickups" aria-current="page">
            {NOT_PACKED_COPY.tab} · {count}
          </Link>
        </Button>
        {shop && (
          <Button asChild size="sm" variant="outline" className="min-h-10">
            <Link href="/admin/orders/pickups">{NOT_PACKED_COPY.allShops}</Link>
          </Button>
        )}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-card border bg-card p-6 text-center text-sm text-muted-foreground">{NOT_PACKED_COPY.empty}</p>
      ) : (
        <NotPackedList rows={rows} now={now} />
      )}
    </div>
  );
}
