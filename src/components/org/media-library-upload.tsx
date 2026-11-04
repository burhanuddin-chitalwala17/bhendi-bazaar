"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { buildImagePath } from "@server/catalog/image-paths";
import { isVideoContentType } from "@server/catalog/video";
import { uploadBatch } from "@/lib/image/upload-batch";
import { uploadVideo, videoFileProblem } from "@/lib/image/upload-video";
import { orgUploadEndpoints } from "@/lib/image/upload-endpoints";
import { MEDIA_UPLOAD_COPY } from "./media-library-copy";

interface MediaLibraryUploadProps {
  orgId: string;
  orgCode: string;
}

/**
 * Photos and videos into the library with no product yet (media-library R6, video-hosting R1):
 * photographs go through the same browser-to-store batch the gallery editor uses, a video is sent
 * as picked for the worker to make playable, all under the org's own folder. Then the page re-reads
 * so the new tiles are at the top. A file the org already holds is not stored twice (D11).
 */
export function MediaLibraryUpload(props: MediaLibraryUploadProps) {
  // The code only names the storage folder; it is never shown (org-profile R8).
  const { orgId, orgCode } = props;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const endpoints = orgUploadEndpoints(orgId);
    const pathFor = (file: File) => buildImagePath("org", file.name, "library", orgCode);
    const photos = files.filter((file) => !isVideoContentType(file.type));
    const refused: string[] = [];
    let firstError: string | null = null;
    // What the browser can know is refused before a byte moves (video-hosting spec R2).
    const videos = files.filter((file) => {
      if (!isVideoContentType(file.type)) return false;
      const problem = videoFileProblem(file);
      if (problem) {
        refused.push(file.name);
        firstError ??= problem;
      }
      return problem === null;
    });
    let done = 0;
    let photosAdded = 0;
    let videosAdded = 0;
    let reused = 0;
    setProgress({ done, total: files.length });
    try {
      // Videos one after another, as picked (video-hosting trd D2): no downscale, no crop.
      for (const file of videos) {
        try {
          const result = await uploadVideo(file, { endpoints, pathFor });
          if (result.reused) reused += 1;
          else videosAdded += 1;
        } catch (error) {
          refused.push(file.name);
          firstError ??= error instanceof Error ? error.message : MEDIA_UPLOAD_COPY.failed;
        }
        done += 1;
        setProgress({ done, total: files.length });
      }
      if (photos.length > 0) {
        try {
          const batch = await uploadBatch(photos, {
            endpoints,
            pathFor,
            onProgress: (landed) => setProgress({ done: done + landed, total: files.length }),
          });
          photosAdded = batch.urls.filter(Boolean).length - batch.reused;
          reused += batch.reused;
          refused.push(...batch.failed);
          firstError ??= batch.firstError;
        } catch (error) {
          // A refused batch is refused whole (upload-batch.ts), so every photograph is named.
          refused.push(...photos.map((file) => file.name));
          firstError ??= error instanceof Error ? error.message : MEDIA_UPLOAD_COPY.failed;
        }
      }

      const added = [photosAdded > 0 && MEDIA_UPLOAD_COPY.photos(photosAdded), videosAdded > 0 && MEDIA_UPLOAD_COPY.videos(videosAdded)]
        .filter((part): part is string => Boolean(part))
        .join(MEDIA_UPLOAD_COPY.and);
      if (refused.length > 0) {
        toast.error(MEDIA_UPLOAD_COPY.refused(refused.join(", "), firstError, added));
      } else if (!added && reused > 0) {
        toast.info(MEDIA_UPLOAD_COPY.alreadyHere(reused));
      } else {
        toast.success(MEDIA_UPLOAD_COPY.added(added, reused));
      }
      if (added || reused > 0) router.refresh();
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <Button type="button" onClick={() => input.current?.click()} pending={progress !== null} size="sm">
        {!progress && <Icon name="upload" className="mr-2" />}
        {progress ? (progress.total > 1 ? MEDIA_UPLOAD_COPY.uploadingMany(progress.done, progress.total) : MEDIA_UPLOAD_COPY.uploading) : MEDIA_UPLOAD_COPY.upload}
      </Button>
      <input ref={input} type="file" accept="image/*,video/*" multiple onChange={handleFiles} className="hidden" />
    </>
  );
}
