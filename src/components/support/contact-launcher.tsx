"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

import { ContactSheet } from "@/components/support/contact-sheet";
import { Button } from "@/components/ui/button";
import { CONTACT_LAUNCHER_COPY } from "./support-copy";

/**
 * A Contact us trigger plus the sheet it opens. The header (desktop) and the tab bar
 * (phone) style the trigger differently; the state and the sheet are the same.
 */
export function ContactLauncher({
  className,
  children,
  variant = "ghost",
  prefill,
}: {
  className?: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  prefill?: { subject: string; message: string };
}) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <>
      <Button
        variant={variant}
        type="button"
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </Button>
      <ContactSheet
        open={open}
        onOpenChange={setOpen}
        signedIn={Boolean(session?.user?.email)}
        prefill={prefill}
      />
    </>
  );
}
