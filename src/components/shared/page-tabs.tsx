import Link from "next/link";

import { cn } from "@/lib/utils";

export interface PageTab {
  key: string;
  label: string;
  href: string;
  /** What waits under this tab. Hidden at zero: a "0" is noise, not information. */
  count?: number;
}

/**
 * Route tabs: each is a link, so a filter is a URL that can be shared, reloaded and rendered on
 * the server. On a phone the row scrolls sideways rather than wrapping.
 */
export function PageTabs({
  tabs,
  current,
  label,
  className,
}: {
  tabs: readonly PageTab[];
  /** The key of the tab this page is showing. */
  current: string;
  /** What the tabs choose between, for assistive technology: "Order status". */
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("no-scrollbar overflow-x-auto border-b border-border", className)}>
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-small transition-colors duration-fast ease-standard",
                  active
                    ? "border-primary font-semibold text-foreground"
                    : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count ? (
                  <span className={cn("tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{tab.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
