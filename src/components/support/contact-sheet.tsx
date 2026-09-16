"use client";

import { useState } from "react";
import { CheckCircle2, Mail, MessageCircle } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SUPPORT_WHATSAPP } from "@/lib/config";
import { SOCIAL_BRAND } from "@/lib/social-brand";
import { whatsappSupportUrl } from "@/lib/support-contact";
import {
  ContactMessageForm,
  type ContactSender,
} from "@/components/support/contact-message-form";

type Step = "choices" | "message" | "sent";

interface ContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The signed-in account, when there is one. */
  sender?: ContactSender | null;
}

// A 56px row: icon, what it does, and what to expect from it. Full width at base, which
// is what makes both options thumb-reachable in a bottom sheet (ADR-0015, ADR-0016).
const OPTION_ROW =
  "flex w-full items-center gap-3 rounded-card border border-border/70 bg-card px-4 py-3 text-left transition-colors hover:bg-muted";

/**
 * Contact us — the two ways to reach the store (docs/specs/contact-us/).
 *
 * Controlled, because the account menu closes on an outside click: a sheet owning its
 * own state from inside that menu would unmount with its trigger (TRD D8).
 *
 * The form replaces the options in the same sheet rather than navigating, so a back
 * gesture cannot take a half-written message with it (spec R4).
 */
export function ContactSheet({ open, onOpenChange, sender }: ContactSheetProps) {
  const [step, setStep] = useState<Step>("choices");

  function handleOpenChange(next: boolean) {
    if (!next) setStep("choices");
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:mx-auto sm:max-w-md">
        <SheetTitle>
          {step === "message"
            ? "Send us a message"
            : step === "sent"
              ? "Message sent"
              : "Contact us"}
        </SheetTitle>
        <SheetDescription className="text-2xs">
          {step === "message"
            ? "We will reply by email."
            : step === "sent"
              ? "It is with us now."
              : "Chat with us, or leave a message and we will reply by email."}
        </SheetDescription>

        {step === "choices" && (
          <div className="space-y-2 pt-1">
            <a
              href={whatsappSupportUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleOpenChange(false)}
              className={OPTION_ROW}
            >
              <MessageCircle className={`size-5 shrink-0 ${SOCIAL_BRAND.whatsapp.color}`} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">WhatsApp</span>
                <span className="block text-2xs text-muted-foreground">
                  Chat on {SUPPORT_WHATSAPP.display} — fastest reply
                </span>
              </span>
            </a>

            <button type="button" onClick={() => setStep("message")} className={OPTION_ROW}>
              <Mail className="size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Send a message</span>
                <span className="block text-2xs text-muted-foreground">
                  Write to us here and we will email you back
                </span>
              </span>
            </button>
          </div>
        )}

        {step === "message" && (
          <ContactMessageForm
            sender={sender}
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
              We usually reply within a day. For something urgent, WhatsApp is faster.
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
