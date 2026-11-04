"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MORE_TAB, PORTAL_NAV, activeTabKey, portalHref, type PortalNavKey } from "@/components/layout/portal-nav";
import { ORG_TAB_BAR_COPY } from "./layout-copy";
import { ROUTES } from "@server/shared/routes";

// The shop's phone navigation: Home · Products · Orders · Earnings, then More, which opens the
// grouped list. Same shape as the storefront's bar; hidden from md.

const TAB_CLASSES =
  "relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-none text-2xs font-medium transition-colors duration-fast ease-standard";

function tabTone(active: boolean) {
  return active ? "text-primary" : "text-muted-foreground";
}

/** Work waiting under a tab, from data the layout already read. Nothing at zero. */
export type TabCounts = Partial<Record<PortalNavKey, number>>;

export function OrgTabBar({
  orgId,
  moreOpen,
  onMore,
  counts = {},
}: {
  orgId: string;
  moreOpen: boolean;
  onMore: () => void;
  counts?: TabCounts;
}) {
  const pathname = usePathname();
  const active = activeTabKey(orgId, pathname);
  const tabs = PORTAL_NAV.filter((entry) => entry.tab);

  return (
    <nav
      aria-label={ORG_TAB_BAR_COPY.shop}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      <div className="flex h-tabbar items-stretch">
        {tabs.map((tab) => {
          const isActive = active === tab.key && !moreOpen;
          const label = tab.tabLabel ?? tab.label;
          const count = counts[tab.key] ?? 0;
          return (
            <Link
              key={tab.key}
              prefetch={false}
              href={portalHref(tab, orgId) ?? ROUTES.org.home(orgId)}
              aria-current={isActive ? "page" : undefined}
              aria-label={count > 0 ? `${label}, ${count} waiting` : undefined}
              className={cn(TAB_CLASSES, tabTone(isActive))}
            >
              <span className="relative">
                <Icon name={tab.icon} size="md" filled={isActive} />
                {count > 0 && (
                  <span
                    aria-hidden
                    className="absolute -right-2.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold leading-none tabular-nums text-primary-foreground"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          className={cn(TAB_CLASSES, tabTone(moreOpen || active === MORE_TAB))}
        >
          <Icon name="menu" size="md" />
          {ORG_TAB_BAR_COPY.more}
        </Button>
      </div>
    </nav>
  );
}
