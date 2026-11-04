import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { isDomainError } from "@server/shared/domain-error";
import { refundsDAL } from "@/data-access-layer/admin/refunds.dal";
import { ADMIN_SHELL_COPY } from "./admin-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * Everything beneath `/admin` is gated here, not in the middleware.
 *
 * It used to say "middleware already gates this; the fetch is for display", and that
 * was wrong twice over. The matcher skips any path containing a dot, so
 * `/admin/orders/abc.def` reached the page with no check at all — thirteen admin pages
 * carried no guard of their own. And an edge check reads a JWT claim, which survives
 * the account being demoted or blocked; `requirePlatformAdmin` re-reads the row
 * (ADR-0021). The org portal has always done it this way.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requirePlatformAdmin();
  } catch (error) {
    // 401 means sign in and come back; 403 means this account will never have access,
    // so sending it to a sign-in page would be a loop.
    if (isDomainError(error) && error.status === 401) {
      redirect(`${ROUTES.signIn}?callbackUrl=${ROUTES.admin.home}`);
    }
    redirect(ROUTES.home);
  }

  return (
    <div className="portal flex min-h-screen bg-background">
      <AdminSidebar refundsNotStarted={(await refundsDAL.counts()).notStarted} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          name={session.user.name}
          email={session.user.email}
          label={ADMIN_SHELL_COPY.portalLabel}
        />
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
