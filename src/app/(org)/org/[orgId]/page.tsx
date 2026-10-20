import { requireOrgMember } from "@/lib/org-auth";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { OnboardingCard } from "@/components/org/onboarding-card";
import { orgOnboardingService } from "@server/catalog/org-onboarding.service";
import type { OnboardingStatus } from "@server/catalog/org-onboarding.types";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { storefrontService } from "@server/catalog/storefront.service";
import type { BrandPage } from "@/data-access-layer/storefront.dal";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ChannelAttentionBanner } from "@/components/channel/channel-attention-banner";
import { channelsDAL } from "@/data-access-layer/channels.dal";

export const metadata = { robots: { index: false, follow: false } };

/** Like every widget below it, the card fails alone: a status read that throws costs the card, never the page. */
async function readOnboarding(orgId: string): Promise<OnboardingStatus | null> {
  try {
    return await orgOnboardingService.status(orgId);
  } catch (error) {
    console.error("[OrgDashboard] onboarding status failed:", error);
    return null;
  }
}

/** The same rule as the status above: a page the shop can still run without costs the line, not the card. */
async function readBrandPage(orgId: string): Promise<BrandPage | null> {
  try {
    const settings = await storefrontService.getSettings(orgId);
    return await storefrontDAL.getBrandPage(settings.handle);
  } catch (error) {
    console.error("[OrgDashboard] brand page read failed:", error);
    return null;
  }
}

/**
 * The org dashboard: the widget registry rendered with an org scope. Which figures
 * appear here — and how each is narrowed to this org — is declared per widget in
 * server/analytics/widgets.ts, not decided by this page (dashboard-widgets R1–R4).
 * Above the grid, onboarding shows the three steps and the store's readiness
 * (org-profile spec R7).
 */
export default async function OrgDashboard({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const [onboarding, brandPage, attention] = await Promise.all([
    readOnboarding(scope.orgId),
    readBrandPage(scope.orgId),
    channelsDAL.attention(scope.orgId),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" title="Dashboard" description="An overview of your organisation" />

      <ChannelAttentionBanner orgId={scope.orgId} attention={attention} />

      {onboarding && (
        <OnboardingCard status={onboarding} orgId={scope.orgId} page={brandPage} />
      )}

      <DashboardWidgets
        ctx={{ audience: "org", orgId: scope.orgId }}
        basePath={`/org/${scope.orgId}`}
      />
    </div>
  );
}
