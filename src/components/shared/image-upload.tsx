/**
 * Image Upload Component
 * Handles single and multiple image uploads, through the server, to Cloudflare R2 (ADR-0028)
 */

"use client";

import { useId, useState, useRef } from "react";
import NextImage from "next/image";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { useLocalPreviews } from "@/hooks/core/useLocalPreviews";
import { useMutation } from "@/hooks/core/useMutation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { uploadApiClient } from "@/components/shared/uploadApiClient";

interface ImageUploadProps {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  required?: boolean;
  uploadType?: "products" | "categories" | "reviews";
  /** Upload route — the caller knows whose guard applies (admin vs org member). */
  endpoint?: string;
}

export function ImageUpload({
  label,
  value,
  onChange,
  maxImages = 10,
  required = false,
  uploadType = "products",
  endpoint = "/api/admin/upload",
}: ImageUploadProps) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const upload = useMutation((files: File[]) => uploadApiClient.uploadFiles(endpoint, uploadType, files));
  const isUploading = upload.isLoading;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();
  const { remember, localPreview } = useLocalPreviews();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check max images limit
    if (value.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploadProgress(0);

    try {
      // useMutation toasts the failure with the server's reason.
      const urls = await upload.mutate(files);
      remember(files, urls);
      onChange([...value, ...urls]);
      setUploadProgress(100);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newValue = [...value];
    const [removed] = newValue.splice(fromIndex, 1);
    newValue.splice(toIndex, 0, removed);
    onChange(newValue);
  };

  return (
    <div>
      <Label htmlFor={fileInputId} required={required} className="mb-2">
        {label}
      </Label>

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {value.map((url, index) => (
          <div
            key={index}
            className="relative group aspect-[3/4] bg-muted rounded-lg overflow-hidden border-2 border-border"
          >
            {localPreview(url) ? (
              /* Uploaded in this session, so the bytes are already here — rendering the
                 stored copy instead would buy nothing and cost egress (ADR-0026). A
                 blob: URL is also not something next/image can take. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={localPreview(url)!}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <NextImage
                src={url}
                alt={`Upload ${index + 1}`}
                fill
                sizes="(min-width: 768px) 25vw, 50vw"
                className="object-cover"
              />
            )}

            {/* Overlay with buttons - shows on hover */}
            <div className="absolute inset-0 transition-all flex items-center justify-center gap-2">
              <Button
                variant="destructive"
                shape="icon"
                type="button"
                onClick={() => handleRemove(index)}
                className="opacity-0 group-hover:opacity-100 hover:bg-destructive transition-opacity"
              >
                <Icon name="close" size="sm" />
              </Button>
              {index > 0 && (
                <Button
                  variant="ghost"
                  shape="icon"
                  type="button"
                  onClick={() => handleReorder(index, index - 1)}
                  className="opacity-0 group-hover:opacity-100 bg-info hover:bg-info transition-opacity"
                >
                  ←
                </Button>
              )}
              {index < value.length - 1 && (
                <Button
                  variant="ghost"
                  shape="icon"
                  type="button"
                  onClick={() => handleReorder(index, index + 1)}
                  className="opacity-0 group-hover:opacity-100 bg-info hover:bg-info transition-opacity"
                >
                  →
                </Button>
              )}
            </div>

            {/* Thumbnail badge */}
            {index === 0 && (
              <div className="absolute top-2 left-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                Thumbnail
              </div>
            )}
          </div>
        ))}

        {/* Upload Button */}
        {value.length < maxImages && (
          <Button
            variant="outline"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="aspect-[3/4] border-2 border-dashed hover:border-primary hover:bg-primary/10 flex flex-col items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-sm text-muted-foreground">
                  {uploadProgress}%
                </span>
              </>
            ) : (
              <>
                <Icon name="upload" size="xl" className="text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">
                  Upload Image
                </span>
              </>
            )}
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        Upload up to {maxImages} images. First image will be used as thumbnail.
        Max 5MB per image.
      </p>
    </div>
  );
}
