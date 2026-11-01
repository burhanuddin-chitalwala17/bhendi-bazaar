"use client";

import { useState } from "react";

import { uploadApiClient } from "@/components/shared/uploadApiClient";
import { NOT_A_PHOTO } from "@server/catalog/storefront-copy";

/**
 * Photos for a section sheet, one request each, so one failure costs one photo (ux.md section
 * sheet: Loading "Uploading…", Partial "1 photo didn't upload." with Try again). A file that is
 * not a picture is refused here, before it costs an upload (Terminal error).
 */
export function usePhotoUploads(orgId: string, onUploaded: (urls: string[]) => void) {
  const [uploading, setUploading] = useState(0);
  const [failed, setFailed] = useState<File[]>([]);
  const [refused, setRefused] = useState<string | null>(null);

  const upload = async (files: File[]) => {
    const photos = files.filter((file) => file.type.startsWith("image/"));
    setRefused(photos.length < files.length ? NOT_A_PHOTO : null);
    if (!photos.length) return;
    setFailed([]);
    setUploading((n) => n + photos.length);
    const results = await Promise.allSettled(
      photos.map((file) => uploadApiClient.uploadFiles(`/api/org/${orgId}/upload`, "products", [file])),
    );
    setUploading((n) => n - photos.length);
    const urls = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    setFailed(photos.filter((_, i) => results[i].status === "rejected"));
    if (urls.length) onUploaded(urls);
  };

  return { upload, retry: () => upload(failed), uploading, failedCount: failed.length, refused };
}
