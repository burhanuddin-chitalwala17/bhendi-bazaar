"use client";

import { FormActions } from "@/components/shared/button-groups/FormActions";
import { FormInput, FormTextarea } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  contactMessageSchema,
  guestContactMessageSchema,
  type GuestContactMessageFormValues,
} from "@/lib/validation/schemas/contact.schema";
import { sendContactMessage } from "@/services/contactApiClient";

interface ContactMessageFormProps {
  /** True when a session with an email exists — the reply address is then the account's. */
  signedIn: boolean;
  onSent: () => void;
  onCancel: () => void;
}

/**
 * The email half of Contact us: a subject and a message, emailed to the store.
 * A guest also gives an email, because otherwise there is nobody to reply to.
 */
export function ContactMessageForm({ signedIn, onSent, onCancel }: ContactMessageFormProps) {
  const {
    register,
    onSubmit,
    formError,
    isSubmitting,
    formState: { errors },
  } = useServerForm<GuestContactMessageFormValues>({
    schema: (signedIn ? contactMessageSchema : guestContactMessageSchema) as never,
    defaultValues: { subject: "", message: "", email: "" },
    submit: ({ subject, message, email }) =>
      sendContactMessage(signedIn ? { subject, message } : { subject, message, email }),
    successMessage: "Message sent — we will get back to you.",
    onSuccess: onSent,
    fallbackMessage: "Could not send your message. Please try again.",
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {formError && (
        <div
          role="alert"
          className="rounded-field border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {formError}
        </div>
      )}

      {!signedIn && (
        <FormInput
          label="Your email"
          required
          type="email"
          placeholder="you@example.com"
          hint="So we can reply to you."
          {...register("email")}
          error={errors.email?.message}
        />
      )}

      <FormInput
        label="Subject"
        required
        placeholder="Order, sizing, something else"
        {...register("subject")}
        error={errors.subject?.message}
      />

      <FormTextarea
        label="Message"
        required
        rows={5}
        placeholder="Tell us what you need help with."
        {...register("message")}
        error={errors.message?.message}
      />

      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitLabel="Send message"
        cancelLabel="Back"
      />
    </form>
  );
}
