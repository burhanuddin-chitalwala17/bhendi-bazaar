"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { LifeBuoy } from "lucide-react";

import { ContactSheet } from "@/components/support/contact-sheet";

/**
 * The footer's Contact us control — the signed-out path to both options (spec R5), and
 * the reason this leaf is a client component while the footer around it is not.
 *
 * It owns its own open state, unlike the account menu's entry, because nothing here
 * closes underneath it.
 */
export function ContactLink() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <LifeBuoy className="size-4" />
        Contact us
      </button>
      <ContactSheet open={open} onOpenChange={setOpen} sender={session?.user} />
    </>
  );
}
