import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshButton } from "@/components/channel/refresh-button";
import { cn } from "@/lib/utils";
import { STEP_HINT } from "@/components/layout/portal-hints";
import { ONBOARDING_STEP, type OnboardingStatus } from "@server/catalog/org-onboarding.types";
import type { ShareShop } from "@/lib/store-preview";
import { ShareShopSheet } from "@/components/org/share/share-shop-sheet";
import type { ShareSetup } from "@/components/org/share/useShareShop";
import type { HomeRead } from "@/data-access-layer/org/home.dal";
import { HOME_COPY, STEP_TITLE } from "./home-copy";
import { taskHref } from "./return-to";
import { HideSetupButton, ShowSetupButton } from "./setup-list-actions";
import { SetupStepHint } from "./setup-step-hint";
import { stepRowClass } from "./step-row";

/** Step 5 as the share sheet needs it, so its toast can say the new count. */
export function shareSetupOf(status: OnboardingStatus): ShareSetup {
  return {
    shared: status.steps.some((step) => step.key === ONBOARDING_STEP.SHARE && step.done),
    doneCount: status.doneCount,
  };
}

/** The setup list's anchor on Home. */
export const SETUP_LIST_ID = "setup-list";

/**
 * Home's setup list (R3, A6): ticks from facts, never from a tap on the list; hidden per shop and
 * reachable again here; collapses to one line once all five are done. A step opens its hint (R4);
 * the share step opens the share sheet itself, with its hint on top (D13), so A2 never leaves Home.
 */
export function SetupList({ orgId, setup, share }: { orgId: string; setup: HomeRead<OnboardingStatus>; share: ShareShop | null }) {
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
            <Icon name="success" size="md" tone="success" />
            {HOME_COPY.setUp}
          </p>
          {share && (
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={share.path} target="_blank">{HOME_COPY.seeYourShop}</Link>
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
          <h2 className="font-heading text-title font-semibold">{HOME_COPY.setupTitle(status.doneCount)}</h2>
          <HideSetupButton orgId={orgId} />
        </div>
        <ol className="space-y-1">
          {status.steps.map((step) => {
            const href = step.done ? null : taskHref(orgId, step.key);
            const isNext = step.key === status.next;
            const hint = STEP_HINT[step.key];
            const body = (
              <>
                {step.done ? (
                  <Icon name="success" size="md" tone="success" />
                ) : (
                  <Icon name="dot" size="md" tone={isNext ? "primary" : "muted"} />
                )}
                <span className={cn("min-w-0 flex-1 text-sm", step.done && "text-muted-foreground line-through", isNext && "font-semibold")}>
                  {STEP_TITLE[step.key]}
                </span>
                {href && <Icon name="next" size="sm" tone="muted" />}
              </>
            );
            const row = (
              <Button
                variant="ghost"
                aria-current={isNext ? "step" : undefined}
                className={stepRowClass(isNext)}
              >
                {body}
              </Button>
            );
            return (
              <li key={step.key}>
                {href && share && step.key === ONBOARDING_STEP.SHARE ? (
                  <ShareShopSheet
                    orgId={orgId}
                    shop={share}
                    setup={shareSetupOf(status)}
                    description={hint?.cards.join(" ")}
                    trigger={row}
                  />
                ) : href && hint ? (
                  <SetupStepHint title={STEP_TITLE[step.key]} hint={hint} href={href} isNext={isNext}>
                    {body}
                  </SetupStepHint>
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
