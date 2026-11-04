import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { SkeletonRows } from "@/components/shared/states/skeletons";
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
        back={{ href: "/admin/orgs", label: "Shops" }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {org.isBlocked && (
              <StatusBadge tone="destructive">
                <Icon name="blocked" size="xs" />
                Blocked
              </StatusBadge>
            )}
            <OrgBlockToggle orgId={org.id} isBlocked={org.isBlocked} />
            {/* The team lists a product for a shop in the shop's own steps (product-form R10, Q12). */}
            <Button asChild size="sm">
              <Link href={`/admin/orgs/${org.id}/products/new`} prefetch={false}>Add product for this shop</Link>
            </Button>
            {/* The team uploads a shop's sheet in the shop's own steps (own-store/bulk-sheet R9). */}
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/orgs/${org.id}/products/bulk`} prefetch={false}>Add many for this shop</Link>
            </Button>
          </div>
        }
      />

      <AdminOrgTabs active={activeTab} orgId={orgId} />

      <Suspense key={activeTab} fallback={<SkeletonRows count={5} thumbnail={false} />}>
        {activeTab === "dashboard" && <AdminOrgDashboard orgId={orgId} />}
        {activeTab === "products" && <AdminOrgProducts orgId={orgId} searchParams={searchParams} />}
        {activeTab === "orders" && <AdminOrgOrders orgId={orgId} searchParams={searchParams} />}
        {activeTab === "earnings" && <AdminOrgEarnings orgId={orgId} />}
        {activeTab === "reviews" && <AdminOrgReviews orgId={orgId} searchParams={searchParams} />}
        {!["dashboard", "products", "orders", "earnings", "reviews"].includes(activeTab) && <AdminOrgDashboard orgId={orgId} />}
      </Suspense>
    </PageShell>
  );
}
