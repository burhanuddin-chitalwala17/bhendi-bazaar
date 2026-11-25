"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { orgMediaApiClient } from "./orgMediaApiClient";
import { useMediaDownload, type DownloadableAsset } from "./useMediaDownload";
import { MEDIA_VIEWER_COPY } from "./media-library-copy";

interface MediaDownloadButtonProps {
  orgId: string;
  asset: DownloadableAsset;
}

/**
 * Download for the sheet and the viewer. An anchor, so the browser's own download UI is the
 * progress (trd D4); the tap is held for the HEAD check, so `pending` (buttons only) is a Spinner here.
 */
export function MediaDownloadButton({ orgId, asset }: MediaDownloadButtonProps) {
  const { download, isChecking } = useMediaDownload(orgId);

  if (asset.kind === "VIDEO_EMBED") {
    return (
      <Button type="button" variant="outline" onClick={() => void download(asset)}>
        <Icon name="download" className="mr-2" />
        {MEDIA_VIEWER_COPY.download}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline">
      <a
        href={orgMediaApiClient.downloadHref(orgId, asset.id)}
        aria-busy={isChecking || undefined}
        onClick={(event) => {
          event.preventDefault();
          void download(asset);
        }}
      >
        {isChecking ? <Spinner className="mr-2" /> : <Icon name="download" className="mr-2" />}
        {MEDIA_VIEWER_COPY.download}
      </a>
    </Button>
  );
}
