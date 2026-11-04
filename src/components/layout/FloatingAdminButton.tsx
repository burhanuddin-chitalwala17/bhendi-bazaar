"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PLATFORM_ROLE } from "@server/identity/admin.user.types";

/**
 * A way back to the admin for an admin browsing the store. It sits on the tab bar on a phone,
 * clear of the store's own controls, and folds to a single labelled button.
 */
export function FloatingAdminButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMinimized, setIsMinimized] = useState(false);

  if (status === "loading") return null;
  if (!session?.user || session.user.platformRole !== PLATFORM_ROLE.ADMIN) return null;
  if (pathname?.startsWith("/admin")) return null;

  if (isMinimized) {
    return (
      <Button
        variant="default"
        shape="icon"
        size="lg"
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-tabbar right-4 z-50 mb-3 rounded-full shadow-overlay md:bottom-6 md:mb-0"
        aria-label="Show admin link"
      >
        <Icon name="secure" size="md" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-tabbar right-4 z-50 mb-3 flex items-center gap-1 rounded-full bg-foreground py-1 pl-4 pr-1 text-background shadow-overlay md:bottom-6 md:mb-0">
      <Icon name="secure" />
      <Link prefetch={false} href="/admin" className="inline-flex min-h-10 items-center px-2 text-small font-semibold hover:underline">
        Admin
      </Link>
      <Button variant="inverse" shape="icon" size="sm" onClick={() => setIsMinimized(true)} className="rounded-full" aria-label="Hide admin link">
        <Icon name="close" />
      </Button>
    </div>
  );
}
