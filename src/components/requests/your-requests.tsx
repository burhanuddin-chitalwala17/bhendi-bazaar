import Link from "next/link";

import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { SHOP_STATE, type ShopTicketDTO } from "@server/requests/request.types";
import { ROUTES } from "@server/shared/routes";

import { ReportProblem } from "./report-problem";
import { REQUESTS_COPY as C } from "./requests-copy";

const TONE = { [SHOP_STATE.WITH_US]: "info", [SHOP_STATE.READY]: "success", [SHOP_STATE.NOT_SUPPORTED]: "neutral" } as const;

/** The shop's own tickets, newest first, and Report a problem (setup-requests Q25, ux "Your requests"). */
export function YourRequests({ orgId, tickets }: { orgId: string; tickets: ShopTicketDTO[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-title font-semibold">{C.yourRequests}</h2>
        <ReportProblem orgId={orgId} label={C.reportProblem} />
      </div>
      {tickets.length === 0 ? (
        <p className="text-small text-muted-foreground">{C.noRequests}</p>
      ) : (
        <ul className="divide-y rounded-card border bg-card">
          {tickets.map((t) => {
            const body = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{t.category ? C.issueTitle[t.category] : t.title}</p>
                  {t.names.length > 0 && <p className="break-words text-small text-muted-foreground">{t.names.slice(0, 6).join(", ")}{t.names.length > 6 ? ` ${C.moreNames(t.names.length - 6)}` : ""}</p>}
                </div>
                <StatusBadge tone={TONE[t.state]}>{C.shopState[t.state]}</StatusBadge>
              </>
            );
            return (
              <li key={`${t.id}-${t.productId ?? ""}`}>
                {t.productId ? (
                  <Link href={ROUTES.org.product(orgId, t.productId)} className="flex min-h-14 items-center gap-3 p-4 transition-colors duration-fast ease-standard hover:bg-muted">{body}</Link>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 p-4">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
