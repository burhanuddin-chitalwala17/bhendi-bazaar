"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Star } from "lucide-react";

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
import { reviewApiClient } from "@/services/reviewApiClient";
import { STAR_VALUES } from "@server/catalog/review.types";
import { youtubeWatchUrl } from "@server/catalog/media";
import type { ReviewDto } from "@server/catalog/review.types";

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
      // Back as a watch link, because that is what a reviewer pasted and would recognise;
      // it is parsed to an id again on the way in (ADR-0017 decision 2).
      video: editing?.media.find((item) => item.kind === "YOUTUBE")
        ? youtubeWatchUrl(editing.media.find((item) => item.kind === "YOUTUBE")!.ref)
        : "",
    },
    submit: async (data) => {
      if (editing) return reviewApiClient.update(editing.id, data);
      return reviewApiClient.create(productId, data);
    },
    successMessage: editing ? "Your review is updated" : "Thanks — your review is live",
    onSuccess: () => {
      clearDraft();
      form.reset({
        rating: 0,
        title: "",
        comment: "",
        photos: [],
        video: "",
      });
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
        video: draft.video ?? "",
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
    openAuthSheet({ reason: "Sign in to post your review" });
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
          Your rating <span className="text-destructive">*</span>
        </legend>
        {/* Tap targets, not hover targets: each star is a real button at size-9, which
            is the floor a phone gets (ADR-0015). */}
        <div className="flex items-center gap-0.5">
          {STAR_VALUES.map((star) => (
            <Button
              key={star}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
              aria-pressed={rating === star}
              onClick={() =>
                form.setValue("rating", star, { shouldValidate: true })
              }
            >
              <Star
                className={cn(
                  "size-5",
                  star <= rating
                    ? "fill-warning text-warning"
                    : "fill-transparent text-muted-foreground/50",
                )}
              />
            </Button>
          ))}
        </div>
        {form.formState.errors.rating && (
          <p className="text-3xs text-destructive sm:text-2xs">
            {form.formState.errors.rating.message}
          </p>
        )}
      </fieldset>

      <div className="space-y-1">
        <Label htmlFor="review-title">Headline</Label>
        <Input
          id="review-title"
          placeholder="Sums it up in a line"
          {...form.register("title")}
        />
        {form.formState.errors.title && (
          <p className="text-3xs text-destructive sm:text-2xs">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="review-comment">Your review</Label>
        <Textarea
          id="review-comment"
          rows={4}
          placeholder="How does it fit? How does the fabric feel? Is the colour true to the photographs?"
          {...form.register("comment")}
        />
        {form.formState.errors.comment && (
          <p className="text-3xs text-destructive sm:text-2xs">
            {form.formState.errors.comment.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <span className="text-2xs font-medium sm:text-xs">Photos</span>
        <ReviewPhotoPicker
          photos={(form.watch("photos") as string[] | undefined) ?? []}
          onChange={(photos) =>
            form.setValue("photos", photos as never, { shouldDirty: true })
          }
          disabled={form.isSubmitting}
        />
        {form.formState.errors.photos && (
          <p className="text-3xs text-destructive sm:text-2xs">
            {form.formState.errors.photos.message}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="review-video">Video link (optional)</Label>
        <Input
          id="review-video"
          placeholder="A YouTube link, if you filmed it"
          {...form.register("video")}
        />
        {/* ADR-0017: a reference to a video on somebody else's host, never a file of
            ours — so the field takes a link and the store holds only the id. */}
        {form.formState.errors.video && (
          <p className="text-3xs text-destructive sm:text-2xs">
            {form.formState.errors.video.message}
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
              ? "Saving…"
              : "Save changes"
            : form.isSubmitting
              ? "Posting…"
              : "Post review"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {!isSignedIn && (
        <p className="text-3xs text-muted-foreground sm:text-2xs">
          You will be asked to sign in before it posts. What you have written stays
          here.
        </p>
      )}
    </form>
  );
}
