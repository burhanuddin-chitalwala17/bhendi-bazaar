"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { APP_NAME } from "@/lib/config";
import { useAuthSheet } from "@/context/AuthSheetContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMED_COPY } from "../themed-copy";
import { ROUTES } from "@server/shared/routes";

/** The tab bar's "More" (Q6): the buyer's account and orders, and the way out to the marketplace. Contact is the footer's. */
export function MoreMenu({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { open: openAuthSheet } = useAuthSheet();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="min-w-48">
        {session?.user ? (
          <DropdownMenuItem asChild>
            <Link href={ROUTES.profile} prefetch={false}>{THEMED_COPY.more.account}</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => openAuthSheet()}>{THEMED_COPY.more.login}</DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={ROUTES.orders} prefetch={false}>{THEMED_COPY.more.orders}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={ROUTES.home} prefetch={false}>{THEMED_COPY.more.shopAll(APP_NAME)}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
