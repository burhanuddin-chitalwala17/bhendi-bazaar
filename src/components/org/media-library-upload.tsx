"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildImagePath } from "@server/catalog/image-paths";
import { uploadBatch } from "@/lib/image/upload-batch";
import { orgUploadEndpoints } from "@/lib/image/upload-endpoints";

interface MediaLibraryUploadProps {
  orgId: string;
  orgCode: string;
}

/**
 * Photos into the library with no product yet (media-library R6): the same browser-to-store
 * batch the gallery editor uses, stored under the org's own folder, then the page re-reads so
 * the new tiles are at the top. A photo the org already holds is not stored twice (D11).
 */
export function MediaLibraryUpload({ orgId, orgCode }: MediaLibraryUploadProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setProgress({ done: 0, total: files.length });
    try {
      const { failed, firstError, reused, urls } = await uploadBatch(files, {
        endpoints: orgUploadEndpoints(orgId),
        pathFor: (file) => buildImagePath("products", file.name, "library", orgCode),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const added = urls.filter(Boolean).length - reused;
      if (failed.length > 0) {
        toast.error(`Could not upload ${failed.join(", ")} (${firstError}).${added > 0 ? " The rest were added." : ""}`);
      } else if (reused > 0 && added === 0) {
        toast.info(reused === 1 ? "That photo is already in your library." : `All ${reused} photos are already in your library.`);
      } else {
        toast.success(
          `${added} photo${added === 1 ? "" : "s"} added${reused > 0 ? `; ${reused} ${reused === 1 ? "was" : "were"} already here` : ""}.`,
        );
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photos");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <Button type="button" onClick={() => input.current?.click()} disabled={progress !== null} size="sm">
        {progress ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
        {progress ? (progress.total > 1 ? `Uploading ${progress.done}/${progress.total}…` : "Uploading…") : "Upload photos"}
      </Button>
      <input ref={input} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
    </>
  );
}
