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
            <Link href="/profile" prefetch={false}>Account</Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => openAuthSheet()}>Login</DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/orders" prefetch={false}>Orders</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" prefetch={false}>Shop all of {APP_NAME}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
