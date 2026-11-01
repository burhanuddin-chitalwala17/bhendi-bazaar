"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MORE_TAB, PORTAL_NAV, activeTabKey, portalHref } from "@/components/layout/portal-nav";

// The shop's phone navigation (own-store onboarding D2, own-store Q13): the four tabs PORTAL_NAV
// marks, then More, which opens the grouped list. Same shape as the storefront's bar; hidden from md.

const TAB_CLASSES =
  "flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-none text-3xs font-medium transition-colors";

function tabTone(active: boolean) {
  return active ? "text-primary" : "text-muted-foreground";
}

export function OrgTabBar({
  orgId,
  moreOpen,
  onMore,
}: {
  orgId: string;
  moreOpen: boolean;
  onMore: () => void;
}) {
  const pathname = usePathname();
  const active = activeTabKey(orgId, pathname);
  const tabs = PORTAL_NAV.filter((entry) => entry.tab);

  return (
    <nav
      aria-label="Shop"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-safe backdrop-blur md:hidden"
    >
      <div className="flex h-tabbar items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key && !moreOpen;
          return (
            <Link
              key={tab.key}
              prefetch={false}
              href={portalHref(tab, orgId) ?? `/org/${orgId}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(TAB_CLASSES, tabTone(isActive))}
            >
              <Icon className="size-5" aria-hidden />
              {tab.label}
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
          <Ellipsis className="size-5" aria-hidden />
          More
        </Button>
      </div>
    </nav>
  );
}
