"use client";

import { FormActions } from "@/components/shared/button-groups/FormActions";
import { FormInput, FormTextarea } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  contactMessageSchema,
  guestContactMessageSchema,
  type GuestContactMessageFormValues,
} from "@/lib/validation/schemas/contact.schema";
import { sendContactMessage } from "@/components/support/contactApiClient";
import { CONTACT_MESSAGE_FORM_COPY } from "./support-copy";

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
export function ContactMessageForm({
  signedIn,
  onSent,
  onCancel,
}: ContactMessageFormProps) {
  const {
    register,
    onSubmit,
    formError,
    isSubmitting,
    formState: { errors },
  } = useServerForm<GuestContactMessageFormValues>({
    schema: (signedIn
      ? contactMessageSchema
      : guestContactMessageSchema) as never,
    defaultValues: { subject: "", message: "", email: "" },
    submit: ({ subject, message, email }) =>
      sendContactMessage(
        signedIn ? { subject, message } : { subject, message, email },
      ),
    successMessage: CONTACT_MESSAGE_FORM_COPY.messageSentWeWill,
    onSuccess: onSent,
    fallbackMessage: CONTACT_MESSAGE_FORM_COPY.couldNotSendMessage,
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
          label={CONTACT_MESSAGE_FORM_COPY.yourEmail}
          required
          type="email"
          placeholder={CONTACT_MESSAGE_FORM_COPY.exampleCom}
          hint={CONTACT_MESSAGE_FORM_COPY.soWeCanReply}
          {...register("email")}
          error={errors.email?.message}
        />
      )}

      <FormInput
        label={CONTACT_MESSAGE_FORM_COPY.subject}
        required
        placeholder={CONTACT_MESSAGE_FORM_COPY.orderSizingSomethingElse}
        {...register("subject")}
        error={errors.subject?.message}
      />

      <FormTextarea
        label={CONTACT_MESSAGE_FORM_COPY.message}
        required
        rows={5}
        placeholder={CONTACT_MESSAGE_FORM_COPY.tellUsWhatNeed}
        {...register("message")}
        error={errors.message?.message}
      />

      <FormActions
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        submitLabel={CONTACT_MESSAGE_FORM_COPY.sendMessage}
        cancelLabel={CONTACT_MESSAGE_FORM_COPY.back}
      />
    </form>
  );
}
