/**
 * The admin's Requests inbox (setup-requests ux "Requests inbox and detail"): requirements and issues,
 * most shops waiting first, then oldest (Q28). A server component; each row opens its own page.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { PageTabs } from "@/components/shared/page-tabs";
import { REQUESTS_COPY as C } from "@/components/requests/requests-copy";
import { adminRequestsDAL } from "@/data-access-layer/admin/requests.dal";
import { REQUIREMENT_MODE, TICKET_STATUS, TICKET_TYPE, type TicketType } from "@server/requests/request.types";
import { ROUTES } from "@server/shared/routes";

export const metadata = { title: C.title, robots: { index: false, follow: false } };

type Search = { type?: string; resolved?: string; page?: string };

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const type: TicketType = search.type === TICKET_TYPE.ISSUE ? TICKET_TYPE.ISSUE : TICKET_TYPE.REQUIREMENT;
  const resolved = search.resolved === "1";
  const page = Math.max(0, Number(search.page ?? 0) || 0);
  const [{ rows, total }, counts] = await Promise.all([adminRequestsDAL.inbox(type, resolved, null, page), adminRequestsDAL.counts()]);
  const href = (q: Partial<Record<keyof Search, string | null>>) => {
    const params = new URLSearchParams();
    const next = { type, resolved: resolved ? "1" : null, ...q };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `${ROUTES.admin.requests}?${qs}` : ROUTES.admin.requests;
  };

  return (
    <PageShell>
      <PageHeader title={C.title} description={C.description} />
      <PageTabs
        label={C.tabsLabel}
        current={type}
        tabs={[
          { key: TICKET_TYPE.REQUIREMENT, label: C.requirements, href: href({ type: TICKET_TYPE.REQUIREMENT, page: null }), count: counts.requirement },
          { key: TICKET_TYPE.ISSUE, label: C.issues, href: href({ type: TICKET_TYPE.ISSUE, page: null }), count: counts.issue },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState title={C.nothingWaiting} description={C.nothingWaitingHow} />
      ) : (
        <ul className="divide-y rounded-card border bg-card">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={ROUTES.admin.request(row.id)} prefetch={false} className="flex min-h-14 items-center gap-3 p-4 transition-colors duration-fast ease-standard hover:bg-muted">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{row.title}</p>
                  <p className="text-small text-muted-foreground">
                    {[row.mode === REQUIREMENT_MODE.DECISION ? C.choose : row.mode === REQUIREMENT_MODE.ONE_TAP ? C.oneTap : null, row.shopsWaiting ? C.shopsWaiting(row.shopsWaiting) : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StatusBadge tone={row.status === TICKET_STATUS.OPEN ? (row.reopened ? "warning" : "info") : row.status === TICKET_STATUS.DONE ? "success" : "neutral"}>
                  {row.status === TICKET_STATUS.OPEN ? (row.reopened ? C.reopened : C.open) : row.status === TICKET_STATUS.DONE ? C.done : C.closed}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="min-h-10">
          <Link href={href({ resolved: resolved ? null : "1", page: null })}>{resolved ? C.showOpen : C.showResolved}</Link>
        </Button>
        {(page + 1) * 25 < total && (
          <Button asChild variant="outline" size="sm" className="min-h-10">
            <Link href={href({ page: String(page + 1) })}>{C.showMore}</Link>
          </Button>
        )}
      </div>
    </PageShell>
  );
}
