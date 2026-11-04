"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FormInput } from "@/components/shared/forms/FormField";
import { ImageSlotField } from "@/components/shared/image-slot/image-slot-field";
import { uploadApiClient } from "@/components/shared/uploadApiClient";
import { BannerPreview } from "@/components/org/banner-preview";
import { orgStorefrontApiClient } from "@/components/org/orgStorefrontApiClient";
import { IMAGE_SLOT } from "@server/catalog/image-slots";
import { previewOf, type ImageSlotValue } from "@server/catalog/image-framing";
import { useServerForm } from "@/hooks/core/useServerForm";
import { orgBannerSchema, type OrgBannerFormInput } from "@/lib/validation/schemas/org-banner.schema";

/** The action every shop banner carries (`storefrontDAL.promotionsFor`); drawn in the preview only. */
const SHOP_NOW = "Shop now";

/**
 * Adding a promotion (storefront-branding R2a) in a full drawer: the words, both pictures and the
 * banner as buyers will see it, together (ADR-0040 case 3, fields beside the preview they change).
 *
 * Apart from the page's own form, because inline these fields read as part of "Save storefront"
 * and nothing was created. Through `useServerForm`, so a rejected field shows its reason on the
 * field ([ADR-0013](../../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
 */
export function AddPromotionSheet({ orgId, handle }: { orgId: string; handle: string }) {
  const router = useRouter();
  // The placeholder shows the real thing an org would paste; this app's origin differs per environment.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const [open, setOpen] = useState(false);
  // Outside the form: the field uploads on its own; the form sends what it holds.
  const [image, setImage] = useState<ImageSlotValue | null>(null);

  const {
    register,
    reset,
    watch,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<OrgBannerFormInput>({
    schema: orgBannerSchema,
    defaultValues: { title: "", description: "", href: "", image: null, imageAlt: "", isActive: true },
    successMessage: "Banner added — it is live on your shop now.",
    submit: (data) => orgStorefrontApiClient.addBanner(orgId, { ...data, image }),
    onSuccess: () => {
      reset();
      setImage(null);
      setOpen(false);
      router.refresh();
    },
  });

  const [title, description, href] = watch(["title", "description", "href"]);
  const words = {
    title: title?.trim() || undefined,
    description: description?.trim() || undefined,
    actions: href?.trim() ? [{ label: SHOP_NOW, href: href.trim() }] : undefined,
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !isSubmitting && setOpen(next)}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Icon name="add" />
          Add banner
        </Button>
      </SheetTrigger>

      <SheetContent side="adaptive" size="full" className="gap-0 overflow-hidden p-0 pb-0 md:pb-0">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 md:px-6 md:py-4">
          <div className="space-y-1">
            <SheetTitle className="font-heading text-title">Add a banner</SheetTitle>
            <SheetDescription className="text-small">It goes live on your shop as soon as you add it.</SheetDescription>
          </div>
          <SheetClose asChild>
            <Button type="button" variant="ghost" shape="icon" size="lg" aria-label="Close">
              <Icon name="close" />
            </Button>
          </SheetClose>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 md:px-6">
            <BannerPreview words={words} image={previewOf(image)} />

            <div className="space-y-4">
              <FormInput label="Title (optional)" placeholder="Eid collection" {...register("title")} error={errors.title?.message} />
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
              <p className="text-caption text-muted-foreground">
                Paste the link to your shop or to one of your products — straight from the address bar is fine. Leave it
                blank for a promotion that is not a link. With no words at all, the picture shows on its own.
              </p>
            </div>

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
              showPreview={false}
            />

            {/* Anything with no field to sit on — a permission failure, a conflict. */}
            {formError && (
              <p role="alert" className="text-small text-destructive">
                {formError}
              </p>
            )}
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-border bg-background px-4 py-3 pb-safe md:px-6">
            <Button type="button" variant="outline" onClick={() => !isSubmitting && setOpen(false)}>
              Cancel
            </Button>
            {/* Never disabled (ADR-0053): a second tap while adding is ignored, not refused. */}
            <Button type="submit" pending={isSubmitting} onClick={(event) => isSubmitting && event.preventDefault()}>
              {isSubmitting ? "Adding…" : "Add banner"}
            </Button>
          </footer>
        </form>
      </SheetContent>
    </Sheet>
  );
}
