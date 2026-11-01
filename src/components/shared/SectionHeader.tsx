// components/shared/SectionHeader.tsx

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHelp } from "@/components/layout/page-help";
import type { PortalNavKey } from "@/components/layout/portal-nav";

interface SectionHeaderProps {
  overline?: string; // "BHENDI BAZAAR"
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  as?: "h1" | "h2" | "h3";
  /** A portal navigation key: renders "?" beside the title (onboarding R5). */
  help?: PortalNavKey;
  className?: string;
}

export function SectionHeader({
  overline,
  title,
  description,
  action,
  className,
  help,
  as: Heading = "h2",
}: SectionHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      {overline && (
        <p className="text-4xs font-semibold uppercase tracking-eyebrow-wide text-muted-foreground/80 sm:text-2xs sm:tracking-display">
          {overline}
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3 sm:gap-4">
        <div className="space-y-0.5 sm:space-y-1">
          <div className="flex items-center gap-1">
            <Heading className="font-heading text-base font-semibold tracking-tight sm:text-2xl">
              {title}
            </Heading>
            {help && <PageHelp help={help} />}
          </div>
          {description && (
            <p className="text-2xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          )}
        </div>
        {action && (
          <>
            {action.href ? (
              <Button asChild variant="outline" size="sm">
                <Link href={action.href} prefetch={false}>
                  {action.label}
                </Link>
              </Button>
            ) : (
              <Button onClick={action.onClick} variant="outline" size="sm">
                {action.label}
              </Button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
