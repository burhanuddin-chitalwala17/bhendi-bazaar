/**
 * Admin Layout
 * Layout wrapper for admin pages
 */

import { AdminSidebar } from "@/admin/sidebar";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { requireSession } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gates /admin to platform admins; this fetch is for display.
  const session = await requireSession();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          name={session.user.name}
          email={session.user.email}
          label="Platform Admin"
        />
        <main className="min-w-0 flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}


