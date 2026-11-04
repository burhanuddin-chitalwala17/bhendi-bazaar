import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/layout/page-help";
import type { PortalNavKey } from "@/components/layout/portal-nav";

interface SectionHeaderProps {
  overline?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** A section title only. The page's h1 is `PageHeader`, so a page has exactly one. */
  as?: "h2" | "h3";
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
      {overline && <p className="text-label uppercase text-muted-foreground">{overline}</p>}
      <div className="flex items-baseline justify-between gap-3 md:gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <Heading className="font-heading text-title font-semibold">{title}</Heading>
            {help && <PageHelp help={help} />}
          </div>
          {description && <p className="text-small text-muted-foreground">{description}</p>}
        </div>
        {action &&
          (action.href ? (
            <Button asChild variant="outline" size="sm">
              <Link href={action.href} prefetch={false}>
                {action.label}
              </Link>
            </Button>
          ) : (
            <Button onClick={action.onClick} variant="outline" size="sm">
              {action.label}
            </Button>
          ))}
      </div>
    </header>
  );
}
