import Link from "next/link";

import { Button } from "@/components/ui/button";
import { refundsDAL } from "@/data-access-layer/admin/refunds.dal";
import { RefundList } from "@/components/order/refunds/refund-list";
import { REFUNDS_COPY } from "@/components/order/refunds/refunds-copy";
import { REFUNDS_PAGE } from "@server/checkout/refund-queue";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ADMIN_ORDERS_COPY } from "../orders-copy";
import { ADMIN_SHELL_COPY } from "../../admin-copy";
import { ROUTES } from "@server/shared/routes";

export const metadata = { title: ADMIN_ORDERS_COPY.refundsTitle, robots: { index: false, follow: false } };

const BASE = ROUTES.admin.refunds;
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
      <PageHeader title={REFUNDS_COPY.title} description={ADMIN_ORDERS_COPY.refundsDescription(counts.notStarted)} />
      <RefundList rows={rows} />
      {(page > 1 || more) && (
        <nav className="flex gap-2" aria-label={ADMIN_SHELL_COPY.pages}>
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
