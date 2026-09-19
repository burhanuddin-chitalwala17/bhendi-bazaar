"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useAuthSheet, type OpenAuthSheet } from "@/context/AuthSheetContext";

/** A page-body prompt to sign in: opens the sheet rather than leaving the page (D9). */
export function SignInButton({
  children = "Sign in",
  className,
  ...options
}: OpenAuthSheet & { children?: ReactNode; className?: string }) {
  const { open } = useAuthSheet();
  return (
    <Button type="button" onClick={() => open(options)} className={className}>
      {children}
    </Button>
  );
}
