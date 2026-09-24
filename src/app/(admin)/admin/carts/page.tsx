/**
 * Abandoned Carts — a server component ([ADR-0034]).
 *
 * Filters live in the URL so the server can answer. The client leaves are the filter selects,
 * and the table with its detail dialog and reminder action.
 */
import { PageHeader } from "@/components/shared/page-shell";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { adminCartsDAL } from "@/data-access-layer/admin/carts.dal";
import { CartsFilters } from "@/components/cart/console/CartsFilters";
import { CartsTable } from "@/components/cart/console/CartsTable";
import { DEFAULT_PAGE_SIZE, resolvePageNumber, resolvePageSize } from "@server/shared/pagination";

/** A positive whole number from the query string, or nothing. Untrusted like any input. */
function positiveInt(value?: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default async function AdminCartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = resolvePageNumber(one("page"));
  const limit = resolvePageSize(one("limit"), DEFAULT_PAGE_SIZE);

  const { carts, total, totalPages, totalValue } = await adminCartsDAL.list({
    minDays: positiveInt(one("minDays")) ?? 1,
    minValue: positiveInt(one("minValue")),
    page,
    limit,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abandoned Carts"
        description="Carts left behind, and what they are worth"
        actions={<PriceDisplay price={totalValue || 0} size="lg" />}
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <CartsFilters />
      </div>

      <CartsTable
        carts={carts}
        page={page}
        pageSize={limit}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
