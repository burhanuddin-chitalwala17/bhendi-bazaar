import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshButton } from "@/components/channel/refresh-button";
import { cn } from "@/lib/utils";
import type { OnboardingStatus } from "@server/catalog/org-onboarding.types";
import type { HomeRead } from "@/data-access-layer/org/home.dal";
import { HOME_COPY, STEP_TITLE } from "./home-copy";
import { taskHref } from "./return-to";
import { HideSetupButton, ShowSetupButton } from "./setup-list-actions";

/** The id More → "Setup list" lands on (portal-nav). */
export const SETUP_LIST_ID = "setup-list";

/**
 * Home's setup list (R3, A6): ticks from facts, never from a tap on the list; hidden per shop and
 * reachable again here; collapses to one line once all five are done.
 */
export function SetupList({ orgId, setup, shopPath }: { orgId: string; setup: HomeRead<OnboardingStatus>; shopPath: string | null }) {
  if (!setup.ok) {
    return (
      <Card id={SETUP_LIST_ID} className="py-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{HOME_COPY.setupFailed}</p>
          <RefreshButton label={HOME_COPY.tryAgain} />
        </CardContent>
      </Card>
    );
  }
  const status = setup.value;

  if (status.complete) {
    return (
      <Card id={SETUP_LIST_ID} className="py-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
            {HOME_COPY.setUp}
          </p>
          {shopPath && (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={shopPath} target="_blank">{HOME_COPY.seeYourShop}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (status.hidden) {
    return (
      <Card id={SETUP_LIST_ID} className="py-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{HOME_COPY.setupTitle(status.doneCount)}</p>
          <ShowSetupButton orgId={orgId} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id={SETUP_LIST_ID} className="py-4">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">{HOME_COPY.setupTitle(status.doneCount)}</h2>
          <HideSetupButton orgId={orgId} />
        </div>
        <ol className="space-y-1">
          {status.steps.map((step) => {
            const href = step.done ? null : taskHref(orgId, step.key);
            const isNext = step.key === status.next;
            const body = (
              <>
                {step.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
                ) : (
                  <Circle className={cn("size-5 shrink-0", isNext ? "text-primary" : "text-muted-foreground")} aria-hidden />
                )}
                <span className={cn("min-w-0 flex-1 text-sm", step.done && "text-muted-foreground line-through", isNext && "font-semibold")}>
                  {STEP_TITLE[step.key]}
                </span>
                {href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              </>
            );
            return (
              <li key={step.key}>
                {href ? (
                  <Link
                    href={href}
                    aria-current={isNext ? "step" : undefined}
                    className={cn("flex min-h-11 items-center gap-3 rounded-card px-2 transition-colors hover:bg-muted/60", isNext && "bg-muted")}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex min-h-11 items-center gap-3 px-2">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
