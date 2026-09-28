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
import { Badge } from "@/components/ui/badge";
import { EnhancementSettingsForm } from "@/components/content/enhancement-settings-form";
import { OrgEnhancementPolicyForm } from "@/components/content/org-enhancement-policy-form";
import { formatCurrency } from "@/lib/format";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminEnhancementsPage() {
  await requirePlatformAdmin();
  const [settings, spentTodayPaise, orgs] = await Promise.all([
    enhancementService.settings(),
    enhancementService.platformSpendToday(),
    enhancementService.listOrgUsage(),
  ]);
  const capReached = spentTodayPaise >= settings.dailyCapPaise;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Enhancements"
        description="What a shop may improve in a month, and what the platform will spend in a day."
      />

      <Card className="gap-4 p-4 sm:p-6">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold">The platform’s numbers</h2>
          <p className="text-sm text-muted-foreground">
            {settings.configured
              ? "Changing these takes effect on the next request — no deploy."
              : "Nothing has been saved yet, so these are the numbers the code falls back to. Saving makes them the platform's."}
          </p>
        </div>

        <EnhancementSettingsForm settings={settings} />

        <p className={`text-sm ${capReached ? "text-destructive" : "text-muted-foreground"}`}>
          Spent today: <strong>{formatCurrency(spentTodayPaise)}</strong> of{" "}
          {formatCurrency(settings.dailyCapPaise)}
          {capReached && " — enhancement is stopped for every shop until tomorrow."}
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Shops this month</h2>

        {orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No shop has improved a photo this month, and none has a rule of its own.
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
                    {org.paused && <Badge variant="destructive">Paused</Badge>}
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-2xs uppercase tracking-eyebrow text-muted-foreground">
                        Used
                      </dt>
                      <dd className="font-medium">
                        {org.used} of {org.monthlyAllowance}
                        {org.monthlyAllowanceOverride !== null && (
                          <span className="text-muted-foreground"> · its own</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-2xs uppercase tracking-eyebrow text-muted-foreground">
                        Cost
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
