import Link from "next/link";

import { Button } from "@/components/ui/button";
import { refundsDAL } from "@/data-access-layer/admin/refunds.dal";
import { RefundList } from "@/components/order/refunds/refund-list";
import { REFUNDS_COPY } from "@/components/order/refunds/refunds-copy";
import { REFUNDS_PAGE } from "@server/checkout/refund-queue";
import { PageHeader, PageShell } from "@/components/shared/page-shell";

export const metadata = { title: "Refunds", robots: { index: false, follow: false } };

const BASE = "/admin/orders/refunds";
const pageHref = (page: number) => (page > 1 ? `${BASE}?page=${page}` : BASE);

/**
 * Every refund owed and started (order-fulfilment R14, ux.md "admin refunds"): what is still owed,
 * oldest first, then what has started, 50 to a page.
 */
export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const [rows, counts] = await Promise.all([refundsDAL.page(page), refundsDAL.counts()]);
  const more = page * REFUNDS_PAGE < counts.all;

  return (
    <PageShell width="wide">
      <PageHeader title={REFUNDS_COPY.title} description={`${counts.notStarted} owed, oldest first. Started refunds follow.`} />
      <RefundList rows={rows} />
      {(page > 1 || more) && (
        <nav className="flex gap-2" aria-label="Pages">
          {page > 1 && (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(page - 1)} prefetch={false}>{REFUNDS_COPY.previous}</Link>
            </Button>
          )}
          {more && (
            <Button asChild size="sm" variant="outline">
              <Link href={pageHref(page + 1)} prefetch={false}>{REFUNDS_COPY.next}</Link>
            </Button>
          )}
        </nav>
      )}
    </PageShell>
  );
}
