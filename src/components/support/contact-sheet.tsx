"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@server/shared/routes";

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
import { CONTACT_SHEET_COPY } from "./support-copy";

type Step = "choices" | "message" | "sent";

/** Why the sheet was opened: a shopper's question, or a brand asking to partner (/business). */
export type ContactIntent = "support" | "partner";

interface ContactSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedIn: boolean;
  /** Words already written for WhatsApp and the message, from a paid feature's lock (feature-access Q26). */
  prefill?: { subject: string; message: string };
  intent?: ContactIntent;
}

// A full-width 56px row keeps both options thumb-reachable in a bottom sheet (ADR-0015).
/**
 * The two ways to reach the store, as one row shape.
 *
 * `h-auto`, `justify-start` and `whitespace-normal` are all load-bearing, and all look
 * removable. One row is an `<a>` and the other a `<Button>`, and `Button`'s base brings
 * a fixed `h-9`, `justify-center` and `whitespace-nowrap` with it. Without these the
 * second row is capped at 36px with its contents centred and its description running
 * off the edge, while the first grows to fit two lines and starts at the left — so the
 * pair sit at different heights with their icons in different places.
 */
const OPTION_ROW =
  "flex h-auto w-full items-center justify-start gap-3 whitespace-normal rounded-card border border-border/70 bg-card px-4 py-3 text-left transition-colors hover:bg-muted";

const TITLES: Record<Step, { title: string; description: string }> = {
  choices: {
    title: CONTACT_SHEET_COPY.contactUs,
    description: CONTACT_SHEET_COPY.chatUsWhatsappEmail,
  },
  message: {
    title: CONTACT_SHEET_COPY.sendUsMessage,
    description: CONTACT_SHEET_COPY.weWillReplyEmail,
  },
  sent: {
    title: CONTACT_SHEET_COPY.messageSent,
    description: CONTACT_SHEET_COPY.wayOurInbox,
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
  prefill,
  intent = "support",
}: ContactSheetProps) {
  const [step, setStep] = useState<Step>("choices");
  const partner = intent === "partner";
  const heading =
    partner && step === "choices"
      ? { title: CONTACT_SHEET_COPY.partnerTitle, description: CONTACT_SHEET_COPY.partnerDescription }
      : TITLES[step];

  function handleOpenChange(next: boolean) {
    if (!next) setStep("choices");
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="adaptive">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <SheetTitle>{heading.title}</SheetTitle>
            <SheetDescription>{heading.description}</SheetDescription>
          </div>
          <SheetClose
            aria-label={CONTACT_SHEET_COPY.close}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Icon name="close" size="sm" />
          </SheetClose>
        </div>

        {step === "choices" && (
          <div className="space-y-2 pt-1">
            <a
              href={prefill ? whatsappSupportUrl(prefill.message) : whatsappSupportUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleOpenChange(false)}
              className={OPTION_ROW}
            >
              <span className={SOCIAL_BRAND.whatsapp.color}>
                <Icon name="message" size="md" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{CONTACT_SHEET_COPY.whatsapp}</span>
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
              <Icon name="email" size="md" tone="muted" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{CONTACT_SHEET_COPY.sendMessage}</span>
                <span className="block text-2xs text-muted-foreground">{CONTACT_SHEET_COPY.emailUsSubjectMessage}</span>
              </span>
            </Button>

            {/* The footer that carries these links is hidden on a phone (store-policies D4). */}
            {!partner && (
              <Link
                href={ROUTES.policies}
                onClick={() => handleOpenChange(false)}
                className={OPTION_ROW}
              >
                <Icon name="file" size="md" tone="muted" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{CONTACT_SHEET_COPY.storePolicies}</span>
                  <span className="block text-2xs text-muted-foreground">{CONTACT_SHEET_COPY.shippingReturnsRefundsPrivacy}</span>
                </span>
              </Link>
            )}
          </div>
        )}

        {step === "message" && (
          <ContactMessageForm
            signedIn={signedIn}
            prefill={prefill}
            onSent={() => setStep("sent")}
            onCancel={() => setStep("choices")}
          />
        )}

        {step === "sent" && (
          <div className="space-y-3 pt-1 text-sm">
            <p className="flex items-center gap-2 text-success">
              <Icon name="success" size="md" />{CONTACT_SHEET_COPY.thankWeHaveMessage}</p>
            <p className="text-2xs text-muted-foreground">{CONTACT_SHEET_COPY.weUsuallyReplyWithin}</p>
            <Button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="h-10 w-full rounded-full text-2xs font-semibold uppercase tracking-eyebrow"
            >{CONTACT_SHEET_COPY.close}</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
