"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormInput } from "@/components/shared/forms/FormField";
import { ImageSlotField } from "@/components/shared/image-slot/image-slot-field";
import { uploadApiClient } from "@/components/shared/uploadApiClient";
import { IMAGE_SLOT } from "@server/catalog/image-slots";
import type { ImageSlotValue } from "@server/catalog/image-framing";
import { useServerForm } from "@/hooks/core/useServerForm";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import {
  orgBannerSchema,
  type OrgBannerFormInput,
} from "@/lib/validation/schemas/org-banner.schema";

/**
 * Adding a promotion (storefront-branding R2a).
 *
 * A dialog rather than fields sitting in the page, because the page already has a form
 * with a Save button and these fields are not part of it. Inline, they read as
 * something that saves with everything else — which is what happened: the fields were
 * filled, "Save storefront" was pressed, and nothing was created.
 *
 * Through `useServerForm`, so the same schema validates here and on the server and a
 * rejected field shows its reason *on the field* ([ADR-0013](../../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
 * Hand-rolled state with a toast was the first attempt: typing `/` as the destination
 * returned a perfectly good per-field message and the dialog dropped it on the floor,
 * leaving a red flash and no indication of which box was wrong.
 */
export function AddPromotionDialog({
  orgId,
  handle,
}: {
  orgId: string;
  handle: string;
}) {
  const router = useRouter();
  // The placeholder shows the real thing an org would paste. Read from the browser
  // rather than a constant: this app's origin differs between a laptop, a preview and
  // production, and CLAUDE.md keeps it out of `src/lib/config.ts` for that reason.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [open, setOpen] = useState(false);
  // Outside the form: the field uploads on its own; the form sends what it holds.
  const [image, setImage] = useState<ImageSlotValue | null>(null);

  const {
    register,
    reset,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<OrgBannerFormInput>({
    schema: orgBannerSchema,
    defaultValues: {
      title: "",
      description: "",
      href: "",
      image: null,
      imageAlt: "",
      isActive: true,
    },
    successMessage: "Banner added — it is live on your shop now.",
    submit: (data) => orgStorefrontApiClient.addBanner(orgId, { ...data, image }),
    onSuccess: () => {
      reset();
      setImage(null);
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Icon name="add" />
          Add banner
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-overlay overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a banner</DialogTitle>
          <DialogDescription>
            It goes live on your shop as soon as you add it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <FormInput
            label="Title (optional)"
            placeholder="Eid collection"
            {...register("title")}
            error={errors.title?.message}
          />
          <FormInput
            label="A line underneath (optional)"
            placeholder="New ridas, in store now"
            {...register("description")}
            error={errors.description?.message}
          />
          <FormInput
            label="Where it points (optional)"
            placeholder={`${origin}/store/${handle}`}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...register("href")}
            error={errors.href?.message}
          />
          <p className="text-2xs text-muted-foreground">
            Paste the link to your shop or to one of your products — straight
            from the address bar is fine. Leave it blank for a promotion that is
            not a link.
          </p>
          <p className="text-2xs text-muted-foreground">
            A promotion with no words at all shows the picture on its own, with
            nothing laid over it.
          </p>

          <ImageSlotField
            slot={IMAGE_SLOT.ORG_BANNER}
            label="Picture (optional)"
            value={image}
            onChange={setImage}
            upload={async (file) => {
              const [url] = await uploadApiClient.uploadFiles(`/api/org/${orgId}/upload`, "products", [file]);
              return url;
            }}
            error={errors.image?.message}
          />

          {/* Anything with no field to sit on — a permission failure, a conflict on
              something not in this form. Without it those would vanish. */}
          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!isSubmitting) setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={(event) => {
                // Never disabled (ADR-0053): a second tap while adding is ignored, not refused.
                if (isSubmitting) event.preventDefault();
              }}
            >
              {isSubmitting ? "Adding…" : "Add banner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
