/**
 * One request (setup-requests ux "Requirement detail", "Issue detail"). A requirement shows the setup
 * and how many shops wait, never which (Q3); an issue shows each shop's report (Q22).
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { MarkFixedButton } from "@/components/requests/mark-fixed-button";
import { RequirementPlan } from "@/components/requests/requirement-plan";
import { REQUESTS_COPY as C } from "@/components/requests/requests-copy";
import { adminRequestsDAL } from "@/data-access-layer/admin/requests.dal";
import { TICKET_STATUS, type TicketStatus } from "@server/requests/request.types";
import { ROUTES } from "@server/shared/routes";

export const metadata = { title: C.title, robots: { index: false, follow: false } };

const STATUS = (status: TicketStatus, reopened: boolean) =>
  status === TICKET_STATUS.OPEN ? { tone: reopened ? ("warning" as const) : ("info" as const), text: reopened ? C.reopened : C.open }
    : status === TICKET_STATUS.DONE ? { tone: "success" as const, text: C.done } : { tone: "neutral" as const, text: C.closed };

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await adminRequestsDAL.detail(id);
  if (!detail) notFound();

  if ("requirement" in detail) {
    const r = detail.requirement;
    const s = STATUS(r.status, r.reopened);
    return (
      <PageShell width="narrow">
        <Link href={ROUTES.admin.requests} className="text-small text-muted-foreground underline-offset-4 hover:underline">{C.backMark} {C.back}</Link>
        <PageHeader title={r.title} description={r.shopsWaiting ? C.shopsWaiting(r.shopsWaiting) : undefined} />
        <StatusBadge tone={s.tone}>{s.text}</StatusBadge>
        {r.status === TICKET_STATUS.OPEN ? <RequirementPlan id={r.id} kind={r.kind} shopsWaiting={r.shopsWaiting} open /> : r.status === TICKET_STATUS.DONE ? <p className="text-small">{C.alreadyDone}</p> : null}
      </PageShell>
    );
  }

  const i = detail.issue;
  const s = STATUS(i.status, i.reopened);
  return (
    <PageShell width="narrow">
      <Link href={`${ROUTES.admin.requests}?type=issue`} className="text-small text-muted-foreground underline-offset-4 hover:underline">{C.backMark} {C.back}</Link>
      <PageHeader title={i.title} description={C.reports(i.reports.length)} />
      <StatusBadge tone={s.tone}>{s.text}</StatusBadge>
      <ul className="flex flex-col gap-2">
        {i.reports.map((r) => (
          <li key={`${r.shop}-${r.at}`} className="flex flex-col gap-1 rounded-card border bg-card p-3 text-small">
            <p className="font-semibold">{[r.shop, r.productName].filter(Boolean).join(" · ")}</p>
            {r.category && <p className="text-caption text-muted-foreground">{C.categories[r.category]}</p>}
            <p className="break-words">{r.words ?? C.noWords}</p>
          </li>
        ))}
      </ul>
      {i.error.message && (
        <section className="flex flex-col gap-1 rounded-card border bg-card p-3 text-small">
          <p className="font-semibold">{C.amazonError}</p>
          <p className="text-caption text-muted-foreground">{[i.error.theirCategory, i.error.attribute, i.error.code && C.code(i.error.code)].filter(Boolean).join(" · ")}</p>
          <p className="break-words border-l-2 pl-2 text-muted-foreground">{i.error.message}</p>
        </section>
      )}
      {i.status === TICKET_STATUS.OPEN && <MarkFixedButton id={i.id} />}
    </PageShell>
  );
}
