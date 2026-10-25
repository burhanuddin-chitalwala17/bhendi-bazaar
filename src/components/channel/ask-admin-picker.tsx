"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { APP_SUPPORT_EMAIL } from "@/lib/config";
import { whatsappSupportUrl } from "@/lib/support-contact";

import { ASK_ADMIN } from "./facts-copy";

/**
 * "Ask the admin" (ux.md, Q12, Q13): the message filled in, sent by the shop from its own
 * WhatsApp or mail app. Nothing is sent by us.
 */
export function AskAdminPicker({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const mail = `mailto:${APP_SUPPORT_EMAIL}?subject=${encodeURIComponent(ASK_ADMIN.subject)}&body=${encodeURIComponent(message)}`;
  return (
    <ResponsivePicker
      open={open}
      onOpenChange={setOpen}
      title={ASK_ADMIN.action}
      description={ASK_ADMIN.yourself}
      className="w-80"
      trigger={
        <Button variant="outline" size="sm" className="min-h-10">
          {ASK_ADMIN.action}
        </Button>
      }
    >
      <p className="hidden text-sm text-muted-foreground md:block">{ASK_ADMIN.yourself}</p>
      <div className="flex flex-col gap-2">
        <Button asChild className="min-h-10">
          <a href={whatsappSupportUrl(message)} target="_blank" rel="noopener noreferrer">
            {ASK_ADMIN.whatsapp}
          </a>
        </Button>
        <Button asChild variant="outline" className="min-h-10">
          <a href={mail}>{ASK_ADMIN.email}</a>
        </Button>
      </div>
    </ResponsivePicker>
  );
}
