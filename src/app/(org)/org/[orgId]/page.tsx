import Link from "next/link";
import { Package } from "lucide-react";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import { Card, CardContent } from "@/components/ui/card";

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

      <Link href={`/org/${orgId}/products`} className="block w-full max-w-xs">
        <Card className="transition-colors hover:border-primary/40">
          <CardContent className="flex items-center gap-4 pt-5">
            <Package className="h-8 w-8 text-primary" />
            <span>
              <span className="block text-2xl font-semibold">{pagination.total}</span>
              <span className="text-sm text-muted-foreground">Products</span>
            </span>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
