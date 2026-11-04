/**
 * The channel register — a server component ([ADR-0034]).
 *
 * The number that matters is what is still to do, and it counts only what this catalogue
 * actually sells: a colour nobody has used is not work (channel-registry spec A3).
 */
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { adminChannelRegisterDAL } from "@/data-access-layer/admin/channel-register.dal";
import { ADMIN_CHANNELS_COPY } from "./channels-copy";
import { ROUTES } from "@server/shared/routes";

export const metadata = { title: ADMIN_CHANNELS_COPY.title, robots: { index: false, follow: false } };

export default async function AdminChannelsPage() {
  const summary = await adminChannelRegisterDAL.getSummary();

  return (
    <PageShell>
      <PageHeader
        title={ADMIN_CHANNELS_COPY.title}
        description={ADMIN_CHANNELS_COPY.description}
      />

      <ul className="space-y-3">
        {summary.map((row) => (
          <li key={row.channel}>
            <Link href={ROUTES.admin.channel(row.channel)} prefetch={false} className="block">
              <Card className="transition-colors duration-fast ease-standard hover:border-primary">
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-small text-muted-foreground">
                      {ADMIN_CHANNELS_COPY.mapped(row.mapped)}
                    </p>
                  </div>
                  <StatusBadge tone={row.toDo > 0 ? "warning" : "success"}>
                    {ADMIN_CHANNELS_COPY.toDo(row.toDo)}
                  </StatusBadge>
                  <Icon name="next" tone="muted" />
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
