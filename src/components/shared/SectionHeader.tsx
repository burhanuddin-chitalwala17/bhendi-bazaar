// components/shared/SectionHeader.tsx

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface SectionHeaderProps {
  overline?: string; // "BHENDI BAZAAR"
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function SectionHeader({
  overline,
  title,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <header className={cn("space-y-1", className)}>
      {overline && (
        <p className="text-[0.5625rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground/80 sm:text-[0.7rem] sm:tracking-[0.32em]">
          {overline}
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3 sm:gap-4">
        <div className="space-y-0.5 sm:space-y-1">
          <h2 className="font-heading text-base font-semibold tracking-tight sm:text-2xl">
            {title}
          </h2>
          {description && (
            <p className="text-[0.6875rem] text-muted-foreground sm:text-sm">
              {description}
            </p>
          )}
        </div>
        {action && (
          <>
            {action.href ? (
              <Button asChild variant="outline" size="sm">
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button
                onClick={action.onClick}
                variant="outline"
                size="sm"
              >
                {action.label}
              </Button>
            )}
          </>
        )}
      </div>
    </header>
  );
}