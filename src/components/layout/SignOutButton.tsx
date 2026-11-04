"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { SIGN_OUT_BUTTON_COPY } from "./layout-copy";

// The one interactive leaf of the portal header — everything above it stays server-rendered.
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <Button
      variant="ghost"
      type="button"
      onClick={handleSignOut}
      aria-label={compact ? SIGN_OUT_BUTTON_COPY.label : undefined}
      className={cn("text-muted-foreground hover:text-foreground", compact && "max-md:size-10 max-md:p-0")}
    >
      <Icon name="sign-out" size="sm" />
      <span className={cn(compact && "max-md:sr-only")}>{SIGN_OUT_BUTTON_COPY.signOut}</span>
    </Button>
  );
}
