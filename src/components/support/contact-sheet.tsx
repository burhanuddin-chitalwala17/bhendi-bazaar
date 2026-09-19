"use client";

import { useState } from "react";
import { CheckCircle2, Mail, MessageCircle, X } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SUPPORT_WHATSAPP } from "@/lib/config";
import { SOCIAL_BRAND } from "@/lib/social-brand";
import { whatsappSupportUrl } from "@/lib/support-contact";
import { ContactMessageForm } from "@/components/support/contact-message-form";

type Step = "choices" | "message" | "sent";

interface ContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
}

// A full-width 56px row keeps both options thumb-reachable in a bottom sheet (ADR-0015).
/**
 * The two ways to reach the store, as one row shape.
 *
 * `h-auto` and `justify-start` are both load-bearing, and both look removable. One row
 * is an `<a>` and the other a `<Button>`, and `Button`'s base brings a fixed `h-9` and
 * `justify-center` with it. Without these the second row is capped at 36px with its
 * contents centred, while the first grows to fit two lines and starts at the left —
 * so the pair sit at different heights with their icons in different places.
 */
const OPTION_ROW =
  "flex h-auto w-full items-center justify-start gap-3 rounded-card border border-border/70 bg-card px-4 py-3 text-left transition-colors hover:bg-muted";

const TITLES: Record<Step, { title: string; description: string }> = {
  choices: {
    title: "Contact us",
    description: "Chat with us on WhatsApp, or email us a message.",
  },
  message: {
    title: "Send us a message",
    description: "We will reply by email.",
  },
  sent: {
    title: "Message sent",
    description: "It is on its way to our inbox.",
  },
};

/**
 * Contact us — WhatsApp, or a message emailed to the store (docs/specs/contact-us/).
 * A bottom sheet on a phone, a right-hand panel on desktop. The form replaces the
 * options in place, so a back gesture cannot take a half-written message with it.
 */
export function ContactSheet({
  open,
  onOpenChange,
  signedIn,
}: ContactSheetProps) {
  const [step, setStep] = useState<Step>("choices");

  function handleOpenChange(next: boolean) {
    if (!next) setStep("choices");
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="adaptive">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <SheetTitle>{TITLES[step].title}</SheetTitle>
            <SheetDescription>{TITLES[step].description}</SheetDescription>
          </div>
          <SheetClose
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </SheetClose>
        </div>

        {step === "choices" && (
          <div className="space-y-2 pt-1">
            <a
              href={whatsappSupportUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleOpenChange(false)}
              className={OPTION_ROW}
            >
              <MessageCircle
                className={`size-5 shrink-0 ${SOCIAL_BRAND.whatsapp.color}`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">WhatsApp</span>
                <span className="block text-2xs text-muted-foreground">
                  Chat on {SUPPORT_WHATSAPP.display} — fastest reply
                </span>
              </span>
            </a>

            <Button
              variant="ghost"
              type="button"
              onClick={() => setStep("message")}
              className={OPTION_ROW}
            >
              <Mail className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 whitespace-normal">
                <span className="block text-sm font-semibold">
                  Send a message
                </span>
                <span className="block text-2xs text-muted-foreground">
                  Email us a subject and message
                </span>
              </span>
            </Button>
          </div>
        )}

        {step === "message" && (
          <ContactMessageForm
            signedIn={signedIn}
            onSent={() => setStep("sent")}
            onCancel={() => setStep("choices")}
          />
        )}

        {step === "sent" && (
          <div className="space-y-3 pt-1 text-sm">
            <p className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5 shrink-0" />
              Thank you — we have your message.
            </p>
            <p className="text-2xs text-muted-foreground">
              We usually reply within a day. For something urgent, WhatsApp is
              faster.
            </p>
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="h-10 w-full rounded-full text-2xs font-semibold uppercase tracking-eyebrow"
            >
              Close
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
