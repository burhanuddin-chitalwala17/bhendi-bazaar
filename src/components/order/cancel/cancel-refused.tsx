"use client";

import { Button } from "@/components/ui/button";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { CONTACT_US_REFUSALS } from "@server/checkout/parcel-cancel.types";
import { CANCEL_REFUSED_COPY } from "../buyer-cancel-copy";

const CONTACT_US = CANCEL_REFUSED_COPY.contactUs;
const OK = "OK";

/**
 * A cancel the server refused, in its own words (ux.md "Refused" rows): the message replaces the
 * reason list, with "Contact us" when only a person can still stop the parcel, else "OK".
 */
export function CancelRefused({ message, onDone, contactUs }: { message: string; onDone: () => void; contactUs?: boolean }) {
  return (
    <div className="space-y-4 pt-2">
      <p role="alert" className="break-words text-sm">
        {message}
      </p>
      {(contactUs ?? CONTACT_US_REFUSALS.includes(message)) ? (
        <ContactLauncher className="min-h-11 w-full border">{CONTACT_US}</ContactLauncher>
      ) : (
        <Button className="min-h-11 w-full" onClick={onDone}>
          {OK}
        </Button>
      )}
    </div>
  );
}
