import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  ONBOARDING_STEP,
  READINESS_STATE,
  STORE_MISSING,
  type ChannelReadiness,
  type OnboardingStatus,
  type OnboardingStep,
} from "@server/catalog/org-onboarding.types";
import {
  brandPageShowing,
  brandPageStanding,
} from "@/components/storefront/brand-page/standing";
import type { BrandPage } from "@/data-access-layer/storefront.dal";

interface OnboardingCardProps {
  status: OnboardingStatus;
  orgId: string;
  /** The shop's own page, when it has one, for the line about how much of it is live. */
  page?: BrandPage | null;
}

interface StepCopy {
  title: string;
  hint: string;
  href: ((orgId: string) => string) | null;
}

/** The three screens already exist (org-profile trd D8); this only puts them in order. */
const STEP_COPY: Record<OnboardingStep, StepCopy> = {
  [ONBOARDING_STEP.OPEN]: {
    title: "Open your shop",
    hint: "Done the moment your organisation exists.",
    href: null,
  },
  [ONBOARDING_STEP.DESCRIBE]: {
    title: "Describe your shop",
    hint: "A few lines buyers read on your storefront.",
    href: (orgId) => `/org/${orgId}/shop/details`,
  },
  [ONBOARDING_STEP.SELL]: {
    title: "Say what you sell",
    hint: "The brands you carry and the facts every product starts from.",
    href: (orgId) => `/org/${orgId}/listing`,
  },
};

/** Where each thing the store is missing gets done. Keyed by the wording the server chose. */
const MISSING_HREF: Record<string, ((orgId: string) => string) | undefined> = {
  [STORE_MISSING.LOCATION]: (orgId) => `/org/${orgId}/locations`,
  [STORE_MISSING.PRODUCT]: (orgId) => `/org/${orgId}/products/new`,
};

/** "Amazon, Flipkart and Meesho" — one sentence, however many channels are still unknown. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Onboarding as a card at the top of the dashboard (org-profile spec R7, A1). It shows what is
 * done and where the next step lives, and it never asks for anything — a channel's readiness
 * says what is missing, and a step that is not done is simply not done yet.
 */
export function OnboardingCard({ status, orgId, page }: OnboardingCardProps) {
  const pageLine = page ? <PageShowingLine page={page} orgId={orgId} /> : null;

  if (status.complete) {
    return (
      <Card className="py-4">
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
            <p className="text-sm font-medium">Your shop is set up</p>
          </div>
          {pageLine}
        </CardContent>
      </Card>
    );
  }

  const known = status.readiness.filter((entry) => entry.state !== READINESS_STATE.UNKNOWN);
  const unknown = status.readiness.filter((entry) => entry.state === READINESS_STATE.UNKNOWN);

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Set up your shop</h2>
          <p className="text-sm text-muted-foreground">
            Three steps, each saved on its own. Come back to any of them whenever you like.
          </p>
        </div>

        <ol className="space-y-3">
          {status.steps.map(({ key, done }) => (
            <StepRow key={key} copy={STEP_COPY[key]} done={done} orgId={orgId} />
          ))}
        </ol>

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Ready to sell on</p>
          {known.map((entry) => (
            <ReadinessLine key={entry.channel} entry={entry} orgId={orgId} />
          ))}
          {unknown.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {joinNames(unknown.map((entry) => CHANNEL_LABELS[entry.channel]))} readiness arrives
              with the listing rules.
            </p>
          )}
        </div>

        {pageLine && <div className="border-t pt-4">{pageLine}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * How much of the shop's page a buyer currently sees (brand-page D11).
 *
 * The count comes from the same extractors the page runs, so it cannot flatter: a section
 * the shop has not filled in is not counted here either. The detail — which sections, and
 * what each is waiting for — lives on the storefront screen, one tap away.
 */
function PageShowingLine({ page, orgId }: { page: BrandPage; orgId: string }) {
  const { showing, total } = brandPageShowing(brandPageStanding(page, orgId));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Your shop page shows{" "}
        <span className="font-medium text-foreground tabular-nums">
          {showing} of {total}
        </span>{" "}
        sections.
      </p>
      <Button asChild variant="ghost" size="sm">
        <Link href={`/org/${orgId}/shop/details`}>
          {showing === total ? "Review it" : "Fill in the rest"}
        </Link>
      </Button>
    </div>
  );
}

function StepRow({ copy, done, orgId }: { copy: StepCopy; done: boolean; orgId: string }) {
  const href = copy.href?.(orgId);
  return (
    <li className="flex items-start gap-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "text-muted-foreground")}>{copy.title}</p>
        <p className="text-sm text-muted-foreground">{copy.hint}</p>
      </div>
      {href && (
        <Button asChild variant={done ? "ghost" : "outline"} size="sm" className="min-h-10">
          <Link href={href}>{done ? "Edit" : "Start"}</Link>
        </Button>
      )}
    </li>
  );
}

function ReadinessLine({ entry, orgId }: { entry: ChannelReadiness; orgId: string }) {
  const label = CHANNEL_LABELS[entry.channel];
  if (entry.state === READINESS_STATE.READY) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
        <span>{label}: ready</span>
      </p>
    );
  }
  return (
    <p className="text-sm">
      <span>{label}: </span>
      {entry.missing.map((item, index) => {
        const href = MISSING_HREF[item]?.(orgId);
        return (
          <span key={item}>
            {index > 0 && <span className="text-muted-foreground"> · </span>}
            {href ? (
              <Link href={href} className="text-primary underline-offset-4 hover:underline">
                {item}
              </Link>
            ) : (
              item
            )}
          </span>
        );
      })}
    </p>
  );
}
