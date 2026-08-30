"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/forms/FormField";
import { BANNER_IMAGE } from "@/lib/config";
import { readApiError } from "@/lib/api-error";
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    const rejection = await checkBannerImage(file);
    if (rejection) {
      setError(rejection);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("files", file);
      body.append("identifier", "banner");
      const response = await fetch("/api/admin/upload?type=banners", {
        method: "POST",
        body,
      });
      if (!response.ok) throw await readApiError(response);
      const { urls } = (await response.json()) as { urls: string[] };
      onChange(urls[0] ?? null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed."
      );
    } finally {
      setUploading(false);
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
        {value ? (
          <div className="relative overflow-hidden rounded-field border border-border">
            {/* The preview is deliberately the storefront's aspect ratio, so a bad
                crop shows up here rather than on the shop. */}
            <div className="relative aspect-[5/2] w-full">
              <Image src={value} alt="" fill sizes="(min-width: 640px) 48rem, 100vw" className="object-cover" />
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
          <div className="flex aspect-[5/2] w-full items-center justify-center rounded-field border border-dashed border-border bg-muted/50">
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="size-6" />
              <p className="text-2xs uppercase tracking-eyebrow">
                {BANNER_IMAGE.width}×{BANNER_IMAGE.height}
              </p>
            </div>
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
