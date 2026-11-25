import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { MorningEmailSwitch } from "@/components/notifications/morning-email-switch";
import { NOTIFICATIONS_UI_COPY } from "@/components/notifications/notifications-copy";
import { SHOP_DETAILS_COPY } from "@/components/org/shop-details/shop-details-copy";
import { requireOrgMember } from "@/lib/org-auth";
import { notificationsService } from "@server/notifications/notifications.service";
import { ROUTES } from "@server/shared/routes";

/** Notifications (notifications-core ux journey 4): the signed-in member's own switches for this shop. */
export default async function NotificationSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const morningEmail = await notificationsService.morningEmail(scope.userId, scope.orgId);

  return (
    <PageShell width="narrow">
      <PageHeader
        help="details"
        title={NOTIFICATIONS_UI_COPY.settings.title}
        description={NOTIFICATIONS_UI_COPY.settings.help}
        back={{ href: ROUTES.org.shopDetails(scope.orgId), label: SHOP_DETAILS_COPY.title }}
      />
      <MorningEmailSwitch orgId={scope.orgId} initial={morningEmail} />
    </PageShell>
  );
}
