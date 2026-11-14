/**
 * What enhancement may cost, and who may do it (image-enhancement spec R7).
 *
 * The two numbers are settings, not constants: the platform owner changes them here rather than
 * in a deploy (trd D5). A shop appears in the list once it has enhanced something this month or
 * once it has a rule of its own; a shop that is exactly the default carries no row and needs none.
 */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { enhancementService } from "@server/content/enhancement.service";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { EnhancementSettingsForm } from "@/components/content/enhancement-settings-form";
import { OrgEnhancementPolicyForm } from "@/components/content/org-enhancement-policy-form";
import { formatCurrency } from "@/lib/format";
import { ADMIN_ENHANCEMENTS_COPY } from "./enhancements-copy";
import { featureAccessService } from "@server/subscriptions/feature-access.service";
import { FEATURE } from "@/components/subscriptions/features";
import { LOCK_COPY } from "@/components/subscriptions/subscriptions-copy";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminEnhancementsPage() {
  await requirePlatformAdmin();
  const [settings, spentTodayPaise, orgs] = await Promise.all([
    enhancementService.settings(),
    enhancementService.platformSpendToday(),
    enhancementService.listOrgUsage(),
  ]);
  // A shop without Image enhancement keeps its policy, shown paused by the plan (feature-access Q33).
  const enhancing = await featureAccessService.allowedOrgs(FEATURE.IMAGE_ENHANCEMENT, orgs.map((org) => org.orgId));
  const capReached = spentTodayPaise >= settings.dailyCapPaise;

  return (
    <PageShell width="wide">
      <PageHeader
        title={ADMIN_ENHANCEMENTS_COPY.title}
        description={ADMIN_ENHANCEMENTS_COPY.description}
      />

      <Card className="gap-4 p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="font-heading text-title font-semibold">{ADMIN_ENHANCEMENTS_COPY.platformTitle}</h2>
          <p className="text-small text-muted-foreground">
            {settings.configured
              ? ADMIN_ENHANCEMENTS_COPY.configured
              : ADMIN_ENHANCEMENTS_COPY.unconfigured}
          </p>
        </div>

        <EnhancementSettingsForm settings={settings} />

        <p className={`text-small ${capReached ? "text-destructive" : "text-muted-foreground"}`}>
          {ADMIN_ENHANCEMENTS_COPY.spentToday} <strong>{formatCurrency(spentTodayPaise)}</strong> {ADMIN_ENHANCEMENTS_COPY.of}{" "}
          {formatCurrency(settings.dailyCapPaise)}
          {capReached && ADMIN_ENHANCEMENTS_COPY.capReached}
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="font-heading text-title font-semibold">{ADMIN_ENHANCEMENTS_COPY.shopsTitle}</h2>

        {orgs.length === 0 ? (
          <p className="text-small text-muted-foreground">
            {ADMIN_ENHANCEMENTS_COPY.noShops}
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {orgs.map((org) => (
              <li key={org.orgId}>
                <Card className="h-full gap-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{org.name}</p>
                      <p className="text-2xs uppercase tracking-eyebrow text-muted-foreground">
                        {org.code}
                      </p>
                    </div>
                    {org.paused && <StatusBadge tone="destructive">{ADMIN_ENHANCEMENTS_COPY.paused}</StatusBadge>}
                    {!enhancing.has(org.orgId) && <StatusBadge tone="warning">{LOCK_COPY.enhancementPaused}</StatusBadge>}
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-small">
                    <div>
                      <dt className="text-2xs uppercase tracking-eyebrow text-muted-foreground">
                        {ADMIN_ENHANCEMENTS_COPY.used}
                      </dt>
                      <dd className="font-medium">
                        {ADMIN_ENHANCEMENTS_COPY.usedOf(org.used, org.monthlyAllowance)}
                        {org.monthlyAllowanceOverride !== null && (
                          <span className="text-muted-foreground">{ADMIN_ENHANCEMENTS_COPY.ownRule}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-2xs uppercase tracking-eyebrow text-muted-foreground">
                        {ADMIN_ENHANCEMENTS_COPY.cost}
                      </dt>
                      <dd className="font-medium">{formatCurrency(org.spentPaise)}</dd>
                    </div>
                  </dl>

                  <OrgEnhancementPolicyForm
                    org={org}
                    platformDefault={settings.defaultMonthlyAllowance}
                  />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
