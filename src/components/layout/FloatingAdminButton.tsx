"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PLATFORM_ROLE } from "@server/identity/admin.user.types";
import { FLOATING_ADMIN_BUTTON_COPY } from "./layout-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * A way back to the admin for an admin browsing the store. It sits on the tab bar on a phone,
 * clear of the store's own controls, and folds to a single labelled button. Not in a portal: its
 * own chrome has the way out, and a floating button there covers the page's action bar.
 */
export function FloatingAdminButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMinimized, setIsMinimized] = useState(false);

  if (status === "loading") return null;
  if (!session?.user || session.user.platformRole !== PLATFORM_ROLE.ADMIN) return null;
  if (pathname?.startsWith(ROUTES.admin.home) || pathname?.startsWith(ROUTES.org.root)) return null;

  if (isMinimized) {
    return (
      <Button
        variant="default"
        shape="icon"
        size="lg"
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-tabbar right-4 z-50 mb-3 rounded-full shadow-overlay md:bottom-6 md:mb-0"
        aria-label={FLOATING_ADMIN_BUTTON_COPY.showAdminLink}
      >
        <Icon name="secure" size="md" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-tabbar right-4 z-50 mb-3 flex items-center gap-1 rounded-full bg-foreground py-1 pl-4 pr-1 text-background shadow-overlay md:bottom-6 md:mb-0">
      <Icon name="secure" />
      <Link prefetch={false} href={ROUTES.admin.home} className="inline-flex min-h-10 items-center px-2 text-small font-semibold hover:underline">
        {FLOATING_ADMIN_BUTTON_COPY.admin}
      </Link>
      <Button variant="inverse" shape="icon" size="sm" onClick={() => setIsMinimized(true)} className="rounded-full" aria-label={FLOATING_ADMIN_BUTTON_COPY.hideAdminLink}>
        <Icon name="close" />
      </Button>
    </div>
  );
}
