import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { StateActionButton, type StateAction } from "./state-action";
import { ERROR_STATE_COPY } from "@/components/shared/shared-copy";

export interface ErrorStateProps {
  /** What happened, in the viewer's words: "Orders didn't load". */
  title?: string;
  /** Why, and what did not change. */
  description: ReactNode;
  /** Try the same thing again — an error boundary's `retry`. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Instead of a retry, a way out (a server page has no handler to pass). */
  action?: StateAction;
  /** `h1` when the error is the whole page (an error boundary). */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/** Something failed: what happened, and one thing to do about it. */
export function ErrorState({
  title = ERROR_STATE_COPY.title,
  description,
  onRetry,
  retryLabel = ERROR_STATE_COPY.retry,
  action,
  as: Heading = "h2",
  className,
}: ErrorStateProps) {
  const next = onRetry ? { label: retryLabel, onClick: onRetry } : action;
  return (
    <div role="alert" className={cn("flex flex-col items-start gap-3 py-10", className)}>
      <Icon name="warning" size="lg" tone="destructive" />
      <Heading className="text-title font-semibold text-foreground">{title}</Heading>
      <div className="max-w-md text-small text-muted-foreground">{description}</div>
      {next && <StateActionButton action={next} />}
    </div>
  );
}
