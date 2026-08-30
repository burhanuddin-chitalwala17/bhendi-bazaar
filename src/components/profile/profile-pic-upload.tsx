"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

interface ProfilePicUploadProps {
  currentPic: string | null;
  userName: string;
  onUploadComplete: (url: string) => Promise<void>;
  onCancel: () => void; // ✅ Add this
  onRemove?: () => Promise<void>; // ✅ Add this (optional)
}

export function ProfilePicUpload({
  currentPic,
  userName,
  onUploadComplete,
  onCancel,
  onRemove,
}: ProfilePicUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initial = userName?.charAt(0)?.toUpperCase() ?? "B";

  // Validation
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only JPEG, PNG, and WebP images are allowed";
    }
    if (file.size > MAX_SIZE) {
      return "Image must be smaller than 5MB";
    }
    return null;
  }

  async function handleFile(file: File) {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/upload-picture", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const { url } = await response.json();
      await onUploadComplete(url);
      setPreview(null);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  async function handleRemove() {
    if (!onRemove) return;

    if (!confirm("Are you sure you want to remove your profile picture?")) {
      return;
    }

    try {
      setUploading(true);
      await onRemove();
    } catch (err) {
      console.error("Remove error:", err);
      setError("Failed to remove profile picture");
    } finally {
      setUploading(false);
    }
  }

  const displayPic = preview || currentPic;

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Preview or Avatar */}
        {uploading ? (
          <div className="flex h-24 w-24 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : displayPic ? (
          <img
            src={displayPic}
            alt="Profile preview"
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-3xl font-semibold">
            {initial}
          </div>
        )}

        {!uploading && (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="text-center text-xs">
              <p className="font-medium text-foreground">
                Drop image here or click to upload
              </p>
              <p className="text-muted-foreground">
                JPEG, PNG, or WebP · Max 5MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {uploading && (
        <p className="text-center text-xs text-muted-foreground">
          Uploading your photo...
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        {currentPic && onRemove && !uploading && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
            className="rounded-full text-2xs font-semibold uppercase tracking-eyebrow"
          >
            Remove
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={onCancel}
          className="rounded-full text-2xs font-semibold uppercase tracking-eyebrow"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
