import type { ListingScreenDTO } from "@server/channels/platform-listing.types";
import type { ShopTicketDTO } from "@server/requests/request.types";
import { ReportProblem } from "@/components/requests/report-problem";
import { REQUESTS_COPY } from "@/components/requests/requests-copy";

import { Button } from "@/components/ui/button";

import { RaiseRequestButton } from "@/components/requests/raise-request-button";
import { LISTING_FIX } from "@server/channels/platform-listing.types";

import { fieldsTicket, ListingFixes } from "./listing-fixes";
import { FIELD_NAME, PROBLEMS, PUBLISH } from "./platform-listing-copy";

/**
 * The top of a listing with problems (marketplace-publish Q6, ux.md "Needs attention"): how many, each
 * pinned one as a link to its field, and the ones the marketplace named no field for, in full.
 */
export function ListingIssuesBanner({ orgId, screen, tickets = [], from }: { orgId: string; screen: ListingScreenDTO; tickets?: ShopTicketDTO[]; from?: string }) {
  if (screen.issues.length === 0 && !screen.showing) return null;
  const pinned = screen.issues.filter((i) => i.field !== null);
  const general = screen.otherIssues;
  const raiseShown = screen.fixes.some((f) => f.kind === LISTING_FIX.ADMIN) && !fieldsTicket(tickets);
  return (
    <section className="flex flex-col gap-2 rounded-card bg-destructive/10 p-3 text-sm">
      {screen.marketplaceProblems ? (
        <>
          <p className="font-semibold text-destructive">{PROBLEMS.bannerTitle(screen.label, screen.marketplaceProblems.suppressed)}</p>
          <p className="text-muted-foreground">{PROBLEMS.bannerHow(screen.label)}</p>
        </>
      ) : (
        screen.issues.length > 0 && <p className="font-semibold text-destructive">{PUBLISH.general(screen.issues.length)}</p>
      )}
      {pinned.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {pinned.map((issue) => (
            <li key={`${issue.field}-${issue.code}`}>
              <a className="underline underline-offset-4" href={`#field-${issue.field}`}>
                {FIELD_NAME[issue.field as keyof typeof FIELD_NAME]}
              </a>
            </li>
          ))}
        </ul>
      )}
      <ListingFixes orgId={orgId} screen={screen} tickets={tickets} from={from} />
      {general.length > 0 && <p className="font-semibold">{REQUESTS_COPY.unrecognised(screen.label)}</p>}
      {general.map((issue) => (
        <p key={`${issue.code}-${issue.message}`}>
          <span className="font-semibold">{PUBLISH.says(screen.label)}</span> {issue.message}
        </p>
      ))}
      {general.length > 0 && (
        <div className="flex flex-col items-start gap-2">
          {/* One raise button per screen: the fixes' own one raises these too. Raising again only adds this shop's need (Q36). */}
          {!raiseShown && <RaiseRequestButton orgId={orgId} channel={screen.channel} productId={screen.productId} />}
          <p className="text-muted-foreground">{REQUESTS_COPY.tellUs}</p>
          <ReportProblem
            orgId={orgId}
            productId={screen.productId}
            productName={screen.productName}
            label={REQUESTS_COPY.reportThis}
            error={{ source: screen.label, context: screen.draft?.marketplaceType ?? null, code: general[0].code, subject: general[0].attribute ?? null, message: general[0].message }}
          />
        </div>
      )}
      {screen.marketplaceProblems && general.length > 0 && (
        <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
          <a href={PROBLEMS.centralUrl} target="_blank" rel="noreferrer">{PROBLEMS.openCentral}</a>
        </Button>
      )}
      {screen.showing && (screen.showing.title || screen.showing.mainImageUrl) && (
        <p className="text-muted-foreground">{PUBLISH.showingOther(screen.label, screen.showing.title ?? "another photo")}</p>
      )}
    </section>
  );
}
