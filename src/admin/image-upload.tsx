/**
 * Image Upload Component
 * Handles single and multiple image uploads to Vercel Blob
 */

"use client";

import { useState, useRef } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check max images limit
    if (value.length + files.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch(`${endpoint}?type=${uploadType}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      onChange([...value, ...data.urls]);
      setUploadProgress(100);
    } catch (error) {
      console.error("Upload error:", error);
      alert(
        error instanceof Error ? error.message : "Failed to upload images"
      );
    } finally {
      setIsUploading(false);
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
      <label className="block text-sm font-medium text-foreground/80 mb-2">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {value.map((url, index) => (
          <div
            key={index}
            className="relative group aspect-[3/4] bg-muted rounded-lg overflow-hidden border-2 border-border"
          >
            <img
              src={url}
              alt={`Upload ${index + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error("❌ Image failed to load:", url);
                e.currentTarget.src =
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f3f4f6"/><text x="50%" y="50%" font-size="14" text-anchor="middle" dy=".3em" fill="%239ca3af">Failed to load</text></svg>';
                e.currentTarget.style.objectFit = "contain";
              }}
              onLoad={(e) => {
                console.log("✅ Image loaded successfully:", url);
              }}
            />

            {/* Overlay with buttons - shows on hover */}
            <div className="absolute inset-0 transition-all flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="opacity-0 group-hover:opacity-100 p-2 bg-destructive text-primary-foreground rounded-lg hover:bg-destructive transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => handleReorder(index, index - 1)}
                  className="opacity-0 group-hover:opacity-100 p-2 bg-info text-primary-foreground rounded-lg hover:bg-info transition-opacity"
                >
                  ←
                </button>
              )}
              {index < value.length - 1 && (
                <button
                  type="button"
                  onClick={() => handleReorder(index, index + 1)}
                  className="opacity-0 group-hover:opacity-100 p-2 bg-info text-primary-foreground rounded-lg hover:bg-info transition-opacity"
                >
                  →
                </button>
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="aspect-[3/4] border-2 border-dashed border-input rounded-lg hover:border-primary hover:bg-primary/10 transition-colors flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground/70" />
                <span className="text-sm text-muted-foreground">Upload Image</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
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

