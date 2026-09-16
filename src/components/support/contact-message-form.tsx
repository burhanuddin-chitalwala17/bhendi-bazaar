"use client";

import { FormActions } from "@/components/shared/button-groups/FormActions";
import { FormInput, FormTextarea } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  contactMessageSchema,
  type ContactMessageFormValues,
} from "@/lib/validation/schemas/contact.schema";
import { sendContactMessage } from "@/services/contactApiClient";

export interface ContactSender {
  name?: string | null;
  email?: string | null;
}

interface ContactMessageFormProps {
  /** The signed-in account, when there is one. Absent for a visitor. */
  sender?: ContactSender | null;
  onSent: () => void;
  onCancel: () => void;
}

/**
 * The written half of Contact us.
 *
 * A signed-in person's name and email are shown read-only, because the server discards
 * whatever the body carries and reads their account instead (contact-us TRD D3) — an
 * editable field that cannot change the outcome is a lie about what the form does.
 */
export function ContactMessageForm({
  sender,
  onSent,
  onCancel,
}: ContactMessageFormProps) {
  const identityIsKnown = Boolean(sender?.email);

  const {
    register,
    onSubmit,
    formError,
    isSubmitting,
    formState: { errors },
  } = useServerForm<ContactMessageFormValues>({
    schema: contactMessageSchema as never,
    defaultValues: {
      name: sender?.name ?? "",
      email: sender?.email ?? "",
      subject: "",
      message: "",
    },
    submit: sendContactMessage,
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

      <div className="grid gap-3 sm:grid-cols-2">
        <FormInput
          label="Name"
          required
          placeholder="Your name"
          readOnly={identityIsKnown}
          {...register("name")}
          error={errors.name?.message}
        />
        <FormInput
          label="Email"
          required
          type="email"
          placeholder="you@example.com"
          readOnly={identityIsKnown}
          {...register("email")}
          error={errors.email?.message}
        />
      </div>

      {identityIsKnown && (
        <p className="text-2xs text-muted-foreground">
          We will reply to the address on your account.
        </p>
      )}

      <FormInput
        label="Subject"
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
