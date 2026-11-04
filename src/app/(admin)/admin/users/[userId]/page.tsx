import { notFound } from "next/navigation";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { Icon, type IconName } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { adminUsersDAL } from "@/data-access-layer/admin/users.dal";
import { Money } from "@/components/shared/Money";
import { UserBlockToggle } from "@/components/profile/console/UserBlockToggle";
import { formatDay } from "@/lib/format";
import { PLATFORM_ROLE } from "@server/identity/admin.user.types";
import { ADMIN_USERS_COPY } from "../users-copy";
import { ROUTES } from "@server/shared/routes";

function Fact({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon name={icon} tone="muted" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ml-auto min-w-0 truncate font-medium">{children}</dd>
    </div>
  );
}

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
        title={user.name || ADMIN_USERS_COPY.unnamed}
        description={user.email || user.mobile || user.id}
        back={{ href: ROUTES.admin.users, label: ADMIN_USERS_COPY.back }}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4 rounded-card border border-border bg-card p-6">
          <h2 className="text-label uppercase text-muted-foreground">
            {ADMIN_USERS_COPY.profile}
          </h2>
          <dl className="space-y-3 text-small">
            <Fact icon="account" label={ADMIN_USERS_COPY.name}>{user.name || ADMIN_USERS_COPY.none}</Fact>
            <Fact icon="email" label={ADMIN_USERS_COPY.email}>{user.email || ADMIN_USERS_COPY.none}</Fact>
            <Fact icon="phone" label={ADMIN_USERS_COPY.mobile}>{user.mobile || ADMIN_USERS_COPY.none}</Fact>
            <Fact icon="secure" label={ADMIN_USERS_COPY.role}>
              <StatusBadge tone={user.platformRole === PLATFORM_ROLE.ADMIN ? "info" : "neutral"}>
                {user.platformRole === PLATFORM_ROLE.ADMIN ? ADMIN_USERS_COPY.admin : ADMIN_USERS_COPY.buyer}
              </StatusBadge>
            </Fact>
            <Fact icon="calendar" label={ADMIN_USERS_COPY.joined}>{formatDay(user.createdAt)}</Fact>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="text-label uppercase text-muted-foreground">
              {ADMIN_USERS_COPY.activity}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                  <Icon name="orders" />
                  <span className="text-caption">{ADMIN_USERS_COPY.orders}</span>
                </div>
                <p className="mt-1 font-heading text-headline font-semibold tabular-nums">
                  {user.ordersCount ?? 0}
                </p>
              </div>
              <div className="text-center">
                <span className="text-caption text-muted-foreground">
                  {ADMIN_USERS_COPY.totalSpent}
                </span>
                <div className="mt-1">
                  <Money paise={user.totalSpent ?? 0} className="font-heading text-headline font-semibold" />
                </div>
              </div>
            </div>
            <div className="text-caption text-muted-foreground">
              {ADMIN_USERS_COPY.lastActive}{" "}
              {formatDay(user.lastActiveAt)}
            </div>
          </section>

          <section className="space-y-4 rounded-card border border-border bg-card p-6">
            <h2 className="text-label uppercase text-muted-foreground">
              {ADMIN_USERS_COPY.actions}
            </h2>
            <UserBlockToggle userId={user.id} isBlocked={user.isBlocked} />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
