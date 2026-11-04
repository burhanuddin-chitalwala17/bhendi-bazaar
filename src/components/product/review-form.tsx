"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReviewPhotoPicker } from "@/components/product/review-photo-picker";
import { useAuthSheet } from "@/context/AuthSheetContext";
import { useServerForm } from "@/hooks/core/useServerForm";
import { cn } from "@/lib/utils";
import {
  reviewSubmissionSchema,
  type ReviewSubmissionInput,
} from "@/lib/validation/schemas/review.schema";
import { reviewApiClient } from "@/components/product/reviewApiClient";
import { STAR_VALUES } from "@server/catalog/review.types";
import type { ReviewDto } from "@server/catalog/review.types";
import { REVIEW_COPY } from "./product-copy";

/**
 * Writing a review, or editing one of your own.
 *
 * `"use client"` is earned and stops here: the stars are a control, the draft has to
 * survive a sign-in, and the page has to update in place without navigating (R13).
 *
 * A guest sees the same form. What they lose by not being signed in is the submission,
 * not the writing — the draft is put away, the sign-in panel opens over the page, and
 * what they typed is back in the fields when they return (R12). Deliberately not an
 * `AuthIntent`: those *finish* the action after sign-in, and silently publishing
 * someone's words the moment they authenticate is not the same promise as keeping them.
 */
const draftKey = (productId: string) => `bb-review-draft:${productId}`;

export function ReviewForm({
  productId,
  editing,
  onDone,
  onCancel,
}: {
  productId: string;
  /** The review being edited, or undefined when writing a new one (R8, R9). */
  editing?: ReviewDto;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { status } = useSession();
  const { open: openAuthSheet } = useAuthSheet();
  const isSignedIn = status === "authenticated";
  // A ref, not state: whether the draft has been put back is bookkeeping for this effect
  // and nothing renders from it, so setting it must not cause a render of its own.
  const hydratedDraft = useRef(false);

  const form = useServerForm<ReviewSubmissionInput>({
    schema: reviewSubmissionSchema,
    defaultValues: {
      rating: editing?.rating ?? 0,
      title: editing?.title ?? "",
      comment: editing?.comment ?? "",
      photos: editing?.media.filter((item) => item.kind === "IMAGE").map((item) => item.ref) ?? [],
    },
    submit: async (data) => {
      if (editing) return reviewApiClient.update(editing.id, data);
      return reviewApiClient.create(productId, data);
    },
    successMessage: editing ? REVIEW_COPY.form.updated : REVIEW_COPY.form.live,
    onSuccess: () => {
      clearDraft();
      form.reset({ rating: 0, title: "", comment: "", photos: [] });
      // The list, the count, the bars and the tile all have to move together, so the
      // server re-renders rather than this component splicing a row into its own copy.
      router.refresh();
      onDone?.();
    },
  });

  const rating = form.watch("rating");

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey(productId));
    } catch {
      // Storage blocked: nothing was saved, so nothing needs clearing.
    }
  };

  // Put back what a guest had typed before they were asked to sign in. Only for a new
  // review: an edit already starts from the published version.
  useEffect(() => {
    if (editing || hydratedDraft.current) return;
    hydratedDraft.current = true;
    try {
      const raw = sessionStorage.getItem(draftKey(productId));
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<ReviewSubmissionInput>;
      form.reset({
        rating: typeof draft.rating === "number" ? draft.rating : 0,
        title: draft.title ?? "",
        comment: draft.comment ?? "",
        // The photographs were already uploaded before the sign-in, so their URLs come
        // back with the words rather than needing to be chosen again.
        photos: Array.isArray(draft.photos) ? draft.photos : [],
      });
    } catch {
      // A blocked or corrupt store costs the draft, never the form.
    }
  }, [editing, form, productId]);

  const askToSignIn = () => {
    try {
      sessionStorage.setItem(
        draftKey(productId),
        JSON.stringify(form.getValues()),
      );
    } catch {
      // The sign-in still works; only the draft is lost.
    }
    openAuthSheet({ reason: REVIEW_COPY.form.signInReason });
  };

  return (
    <form
      onSubmit={(event) => {
        if (!isSignedIn) {
          event.preventDefault();
          askToSignIn();
          return;
        }
        void form.onSubmit(event);
      }}
      className="space-y-3 rounded-card border border-border/70 bg-card/60 p-3 sm:p-4"
      noValidate
    >
      <fieldset className="space-y-1">
        <legend className="text-2xs font-medium sm:text-xs">
          {REVIEW_COPY.form.yourRating} <span className="text-destructive">*</span>
        </legend>
        {/* Tap targets, not hover targets: each star is a real button at size-9, which
            is the floor a phone gets (ADR-0015). */}
        <div className="flex items-center gap-0.5">
          {STAR_VALUES.map((star) => (
            <Button
              key={star}
              type="button"
              variant="ghost"
              shape="icon"
              aria-label={REVIEW_COPY.form.stars(star)}
              aria-pressed={rating === star}
              onClick={() =>
                form.setValue("rating", star, { shouldValidate: true })
              }
            >
              <Icon name="rating" size="md" filled={star <= rating} tone={star <= rating ? "warning" : "muted"} />
            </Button>
          ))}
        </div>
        {form.formState.errors.rating && (
          <p className="text-caption text-destructive">
            {form.formState.errors.rating.message}
          </p>
        )}
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="review-title">{REVIEW_COPY.form.headline}</Label>
        <Input
          id="review-title"
          placeholder={REVIEW_COPY.form.headlinePlaceholder}
          {...form.register("title")}
        />
        {form.formState.errors.title && (
          <p className="text-caption text-destructive">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="review-comment">{REVIEW_COPY.form.yourReview}</Label>
        <Textarea
          id="review-comment"
          rows={4}
          placeholder={REVIEW_COPY.form.reviewPlaceholder}
          {...form.register("comment")}
        />
        {form.formState.errors.comment && (
          <p className="text-caption text-destructive">
            {form.formState.errors.comment.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <span className="text-2xs font-medium sm:text-xs">{REVIEW_COPY.form.photos}</span>
        <ReviewPhotoPicker
          photos={(form.watch("photos") as string[] | undefined) ?? []}
          onChange={(photos) =>
            form.setValue("photos", photos as never, { shouldDirty: true })
          }
          disabled={form.isSubmitting}
        />
        {form.formState.errors.photos && (
          <p className="text-caption text-destructive">
            {form.formState.errors.photos.message}
          </p>
        )}
      </div>

      {form.formError && (
        <p className="text-2xs text-destructive sm:text-xs">{form.formError}</p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={form.isSubmitting}>
          {editing
            ? form.isSubmitting
              ? REVIEW_COPY.form.saving
              : REVIEW_COPY.form.saveChanges
            : form.isSubmitting
              ? REVIEW_COPY.form.posting
              : REVIEW_COPY.form.post}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {REVIEW_COPY.form.cancel}
          </Button>
        )}
      </div>

      {!isSignedIn && (
        <p className="text-2xs text-muted-foreground sm:text-2xs">
          {REVIEW_COPY.form.signInFirst}
        </p>
      )}
    </form>
  );
}
