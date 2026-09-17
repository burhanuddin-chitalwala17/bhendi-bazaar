"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

import { ContactSheet } from "@/components/support/contact-sheet";

/**
 * A Contact us trigger plus the sheet it opens. The header (desktop) and the tab bar
 * (phone) style the trigger differently; the state and the sheet are the same.
 */
export function ContactLauncher({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <ContactSheet
        open={open}
        onOpenChange={setOpen}
        signedIn={Boolean(session?.user?.email)}
      />
    </>
  );
}
