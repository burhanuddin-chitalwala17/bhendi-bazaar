import { notFound } from "next/navigation";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { adminUsersDAL } from "@/data-access-layer/admin/users.dal";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { UserBlockToggle } from "@/components/profile/console/UserBlockToggle";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  ShoppingCart,
} from "lucide-react";
import { formatDay } from "@/lib/format";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await adminUsersDAL.getById(userId);
  if (!user) notFound();

  return (
    <PageShell width="default">
      <PageHeader
        title={user.name || "Unnamed User"}
        description={user.email || user.mobile || user.id}
        back={{ href: "/admin/users" }}
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile card */}
        <section className="space-y-4 rounded-card border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-eyebrow text-muted-foreground">
            Profile
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <dt className="text-muted-foreground">Name</dt>
              <dd className="ml-auto font-medium">{user.name || "—"}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <dt className="text-muted-foreground">Email</dt>
              <dd className="ml-auto font-medium">{user.email || "—"}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <dt className="text-muted-foreground">Mobile</dt>
              <dd className="ml-auto font-medium">{user.mobile || "—"}</dd>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <dt className="text-muted-foreground">Role</dt>
              <dd className="ml-auto">
                <Badge variant="outline">{user.platformRole}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="ml-auto font-medium">
                {formatDay(user.createdAt)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Stats + actions */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-eyebrow text-muted-foreground">
              Activity
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-xs">Orders</span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {user.ordersCount ?? 0}
                </p>
              </div>
              <div className="text-center">
                <span className="text-xs text-muted-foreground">
                  Total Spent
                </span>
                <div className="mt-1">
                  <PriceDisplay
                    price={user.totalSpent ?? 0}
                    size="lg"
                  />
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Last active:{" "}
              {formatDay(user.lastActiveAt)}
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-eyebrow text-muted-foreground">
              Actions
            </h2>
            <UserBlockToggle userId={user.id} isBlocked={user.isBlocked} />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
