"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import { FormTextarea } from "@/components/shared/forms/FormField";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import {
  platformRetireSchema,
  type PlatformRetireInput,
} from "@/lib/validation/schemas/media-library.schema";

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
    submit: async (data) => {
      const response = await fetch(`/api/admin/media/${assetId}/retire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await readApiError(response);
      toast.success("Taken down. The shop can see why.");
      setOpen(false);
      router.refresh();
      return response.json();
    },
  });

  if (alreadyRetired) return null;

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Take down
      </Button>
      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        title="Take this image down"
        description="It leaves the shop's library now, and the shop is shown the reason you give."
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
              label="Why it is coming down"
              rows={3}
              placeholder="What rule this breaks, in words the shop will understand."
              {...register("reason")}
              error={errors.reason?.message}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? "Taking it down…" : "Take it down"}
              </Button>
            </div>
          </form>
        </div>
      </TaskDialog>
    </>
  );
}
