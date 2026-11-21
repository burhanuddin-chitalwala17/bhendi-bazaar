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
import { AdminOrgPlan } from "@/components/subscriptions/admin-org-plan";
import { AdminOrgCredits } from "@/components/payouts/admin-org-credits";
import { ADMIN_ORGS_COPY } from "../orgs-copy";
import { ROUTES } from "@server/shared/routes";

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
        description={ADMIN_ORGS_COPY.description(org.code, org.email)}
        back={{ href: ROUTES.admin.orgs, label: ADMIN_ORGS_COPY.back }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {org.isBlocked && (
              <StatusBadge tone="destructive">
                <Icon name="blocked" size="xs" />
                {ADMIN_ORGS_COPY.blocked}
              </StatusBadge>
            )}
            <OrgBlockToggle orgId={org.id} isBlocked={org.isBlocked} />
            {/* The team lists a product for a shop in the shop's own steps (product-form R10, Q12). */}
            <Button asChild size="sm">
              <Link href={ROUTES.admin.orgNewProduct(org.id)} prefetch={false}>{ADMIN_ORGS_COPY.addProduct}</Link>
            </Button>
            {/* The team uploads a shop's sheet in the shop's own steps (own-store/bulk-sheet R9). */}
            <Button asChild size="sm" variant="outline">
              <Link href={ROUTES.admin.orgBulkProducts(org.id)} prefetch={false}>{ADMIN_ORGS_COPY.addMany}</Link>
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
        {activeTab === "plan" && <AdminOrgPlan orgId={orgId} shop={org.name} />}
        {activeTab === "credits" && <AdminOrgCredits orgId={orgId} shop={org.name} />}
        {!["dashboard", "products", "orders", "earnings", "reviews", "plan", "credits"].includes(activeTab) && <AdminOrgDashboard orgId={orgId} />}
      </Suspense>
    </PageShell>
  );
}
