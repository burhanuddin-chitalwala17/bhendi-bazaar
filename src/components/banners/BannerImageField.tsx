"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImageIcon, ImageOff, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/forms/FormField";
import { BANNER_IMAGE } from "@/lib/config";
import { useMutation } from "@/hooks/core/useMutation";
import { uploadApiClient } from "@/components/shared/uploadApiClient";
import { isRenderableImageUrl } from "@server/catalog/image-paths";
import { BANNER_IMAGE_HINT, checkBannerImage } from "./banner-image-check";

/**
 * The banner's artwork. The required size is stated before the picker opens and
 * checked before anything is uploaded, so an admin learns the number from the field
 * rather than from a banner that looks wrong on the storefront.
 */
export function BannerImageField({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Said in the field, not toasted: the field is where the admin is looking.
  const upload = useMutation(
    (file: File) => uploadApiClient.uploadFiles("/api/admin/upload", "banners", [file], { identifier: "banner" }),
    { showToast: false },
  );
  const uploading = upload.isLoading;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    const rejection = await checkBannerImage(file);
    if (rejection) {
      setError(rejection);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    try {
      const urls = await upload.mutate(file);
      onChange(urls[0] ?? null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <FormField
      label="Background image"
      hint={BANNER_IMAGE_HINT}
      error={error ?? undefined}
    >
      <div className="space-y-2">
        {isRenderableImageUrl(value) ? (
          <div className="relative overflow-hidden rounded-field border border-border">
            {/* The uploaded file at its own shape — not the storefront's, which varies
                by breakpoint. What the hero keeps of it is the hint's job to explain. */}
            <div className="relative aspect-banner-source w-full">
              <Image
                src={value}
                alt=""
                fill
                sizes="(min-width: 640px) 48rem, 100vw"
                className="object-cover"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Remove image"
              disabled={disabled || uploading}
              onClick={() => {
                onChange(null);
                setError(null);
              }}
              className="absolute right-2 top-2 rounded-full"
            >
              <X />
            </Button>
          </div>
        ) : (
          <div className="flex aspect-banner-source w-full items-center justify-center rounded-field border border-dashed border-border bg-muted/50">
            {/* A stored URL we cannot serve is not an empty field: the artwork is gone
                for good, so say so and let the admin clear it rather than saving a
                dead URL back untouched (OPERATIONS.md, retired store). */}
            {value ? (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-warning">
                <ImageOff className="size-6" />
                <p className="text-2xs">
                  This image is on the retired store and cannot be recovered.
                  Upload a replacement, or remove it.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || uploading}
                  onClick={() => {
                    onChange(null);
                    setError(null);
                  }}
                >
                  Remove image
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground">
                <ImageIcon className="size-6" />
                <p className="text-2xs uppercase tracking-eyebrow">
                  {BANNER_IMAGE.width}×{BANNER_IMAGE.height}
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="h-10 w-full rounded-full text-2xs font-semibold uppercase tracking-eyebrow sm:w-auto"
        >
          {uploading ? (
            <>
              <Loader2 className="animate-spin" /> Uploading
            </>
          ) : (
            <>
              <Upload /> {value ? "Replace image" : "Upload image"}
            </>
          )}
        </Button>
      </div>
    </FormField>
  );
}
