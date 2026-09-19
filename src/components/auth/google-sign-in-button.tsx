"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/shared/GoogleIcon";

/**
 * Continue with Google. The trip leaves the page, so a host with something to finish
 * afterwards records it in `beforeRedirect` — a closure cannot survive it (D6, D7).
 */
export function GoogleSignInButton({
  callbackUrl,
  beforeRedirect,
}: {
  callbackUrl: string;
  beforeRedirect?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        beforeRedirect?.();
        void signIn("google", { callbackUrl });
      }}
      className="h-10 w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}
