"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import { FormTextarea } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { mediaTakedownApiClient } from "@/components/org/mediaTakedownApiClient";
import {
  platformRetireSchema,
  type PlatformRetireInput,
} from "@/lib/validation/schemas/media-library.schema";
import { MEDIA_TAKEDOWN_COPY } from "./media-library-copy";

/**
 * The platform taking one image down (media-library spec R12).
 *
 * The reason is the whole point of the dialog: the shop reads it in its own library, so this
 * is written to be read by them rather than filed by us. A canvas task rather than a picker,
 * because the picture being judged has to be on screen while the words are written
 * ([ADR-0040](../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md) D2).
 */
export function MediaTakedown({
  assetId,
  previewUrl,
  alreadyRetired,
}: {
  assetId: string;
  previewUrl: string | null;
  alreadyRetired: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<PlatformRetireInput>({
    schema: platformRetireSchema,
    defaultValues: { reason: "" },
    submit: (data) => mediaTakedownApiClient.retire(assetId, data),
    successMessage: MEDIA_TAKEDOWN_COPY.done,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  if (alreadyRetired) return null;

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {MEDIA_TAKEDOWN_COPY.open}
      </Button>
      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        title={MEDIA_TAKEDOWN_COPY.title}
        description={MEDIA_TAKEDOWN_COPY.description}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {previewUrl && (
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-card bg-muted">
              <Image src={previewUrl} alt="" fill sizes="(min-width: 768px) 44rem, 100vw" className="object-contain" />
            </div>
          )}
          <form onSubmit={onSubmit} className="shrink-0 space-y-3">
            {formError && (
              <p className="rounded-field bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </p>
            )}
            <FormTextarea
              label={MEDIA_TAKEDOWN_COPY.reason}
              rows={3}
              placeholder={MEDIA_TAKEDOWN_COPY.reasonPlaceholder}
              {...register("reason")}
              error={errors.reason?.message}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {MEDIA_TAKEDOWN_COPY.cancel}
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? MEDIA_TAKEDOWN_COPY.submitting : MEDIA_TAKEDOWN_COPY.submit}
              </Button>
            </div>
          </form>
        </div>
      </TaskDialog>
    </>
  );
}
