import { useRef } from "react";
import { toast } from "sonner";
import { useMutation } from "@/hooks/core/useMutation";
import { ApiError } from "@/lib/api-error";
import { navigateTo, openInNewTab } from "@/lib/browser-navigation";
import { youtubeWatchUrl } from "@server/catalog/media";
import type { MediaAssetDto } from "@server/catalog/media-library.types";
import { orgMediaApiClient } from "./orgMediaApiClient";
import { MEDIA_VIEWER_COPY } from "./media-library-copy";

export type DownloadableAsset = Pick<MediaAssetDto, "id" | "kind" | "ref">;

/**
 * Saves one library item's original. HEAD first, because a refused navigation shows the browser's
 * error page, not the ux toast (viewer trd D5); a YouTube link never reaches the route (Q8).
 */
export function useMediaDownload(orgId: string) {
  // useMutation joins a second tap's request; this keeps it from navigating a second time.
  const asking = useRef(new Set<string>());
  const check = useMutation((assetId: string) => orgMediaApiClient.canDownload(orgId, assetId), { showToast: false });

  const explainYouTube = (ref: string) =>
    toast(MEDIA_VIEWER_COPY.youtubeNoFile, {
      action: { label: MEDIA_VIEWER_COPY.openOnYouTube, onClick: () => openInNewTab(youtubeWatchUrl(ref)) },
    });

  const download = async (asset: DownloadableAsset): Promise<void> => {
    if (asset.kind === "VIDEO_EMBED") {
      explainYouTube(asset.ref);
      return;
    }
    if (asking.current.has(asset.id)) return;
    asking.current.add(asset.id);
    try {
      await check.mutate(asset.id);
    } catch (cause) {
      const status = cause instanceof ApiError ? cause.status : 0;
      if (status === 410) toast.error(MEDIA_VIEWER_COPY.fileGone);
      else if (status === 404) toast.error(MEDIA_VIEWER_COPY.notInLibrary);
      else
        toast.error(MEDIA_VIEWER_COPY.downloadFailed, {
          description: MEDIA_VIEWER_COPY.downloadFailedHint,
          action: { label: MEDIA_VIEWER_COPY.tryAgain, onClick: () => void download(asset) },
        });
      return;
    } finally {
      asking.current.delete(asset.id);
    }
    navigateTo(orgMediaApiClient.downloadHref(orgId, asset.id));
  };

  return { download, isChecking: check.isLoading };
}
