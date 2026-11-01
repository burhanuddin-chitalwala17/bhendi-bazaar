import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { OrgBlockToggle } from "@/components/org/console/OrgBlockToggle";
import { AdminOrgTabs } from "@/components/org/console/AdminOrgTabs";
import { AdminOrgDashboard } from "@/components/org/console/tabs/AdminOrgDashboard";
import { AdminOrgProducts } from "@/components/org/console/tabs/AdminOrgProducts";
import { AdminOrgOrders } from "@/components/org/console/tabs/AdminOrgOrders";
import { AdminOrgEarnings } from "@/components/org/console/tabs/AdminOrgEarnings";
import { AdminOrgReviews } from "@/components/org/console/tabs/AdminOrgReviews";

export default async function AdminOrgDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { orgId } = await params;
  const { tab: activeTab = "dashboard" } = await searchParams;
  const org = await orgsDAL.getById(orgId);
  if (!org) notFound();

  return (
    <PageShell width="wide">
      <PageHeader
        title={org.name}
        description={`${org.code} · ${org.email}`}
        back={{ href: "/admin/orgs" }}
        actions={
          <div className="flex items-center gap-2">
            {org.isBlocked && (
              <Badge variant="destructive">
                <Ban className="mr-1 h-3 w-3" />
                Blocked
              </Badge>
            )}
            <OrgBlockToggle orgId={org.id} isBlocked={org.isBlocked} />
            {/* The team lists a product for a shop in the shop's own steps (product-form R10, Q12). */}
            <Button asChild size="sm">
              <Link href={`/admin/orgs/${org.id}/products/new`}>Add product for this shop</Link>
            </Button>
            {/* The team uploads a shop's sheet in the shop's own steps (own-store/bulk-sheet R9). */}
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/orgs/${org.id}/products/bulk`}>Add many for this shop</Link>
            </Button>
          </div>
        }
      />

      <AdminOrgTabs active={activeTab} orgId={orgId} />

      <Suspense fallback={<div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>}>
        {activeTab === "dashboard" && <AdminOrgDashboard orgId={orgId} />}
        {activeTab === "products" && <AdminOrgProducts orgId={orgId} searchParams={searchParams} />}
        {activeTab === "orders" && <AdminOrgOrders orgId={orgId} searchParams={searchParams} />}
        {activeTab === "earnings" && <AdminOrgEarnings orgId={orgId} />}
        {activeTab === "reviews" && <AdminOrgReviews orgId={orgId} searchParams={searchParams} />}
        {!["dashboard", "products", "orders", "earnings", "reviews"].includes(activeTab) && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            This tab is coming soon.
          </div>
        )}
      </Suspense>
    </PageShell>
  );
}
