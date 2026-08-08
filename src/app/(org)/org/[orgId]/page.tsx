import Link from "next/link";
import { Package } from "lucide-react";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";

export const metadata = { robots: { index: false, follow: false } };

/**
 * A placeholder until dashboard-widgets lands, which is what decides what an org sees
 * here. One real number rather than an empty page.
 */
export default async function OrgDashboard({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const { pagination } = await adminProductsDAL.getProducts({ orgId, page: 1, limit: 1 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">An overview of your organisation</p>
      </div>

      <Link
        href={`/org/${orgId}/products`}
        className="flex w-full max-w-xs items-center gap-4 rounded-lg border border-gray-200 bg-white p-5 transition-colors hover:border-emerald-300"
      >
        <Package className="h-8 w-8 text-emerald-600" />
        <span>
          <span className="block text-2xl font-semibold">{pagination.total}</span>
          <span className="text-sm text-muted-foreground">Products</span>
        </span>
      </Link>
    </div>
  );
}
