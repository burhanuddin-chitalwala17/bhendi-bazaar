import { useState } from "react";
import NextImage from "next/image";
import { Icon, type IconName } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { cn } from "@/lib/utils";
import { PRODUCT_TILE_SIZES } from "@/components/shared/product-card";
import { YouTubePoster } from "@/components/product/youtube-poster";
import { LoadMore } from "@/components/shared/load-more";
import { useMediaLibraryPages } from "@/hooks/product/useMediaLibraryPages";
import type { MediaAssetDto } from "@server/catalog/media-library.types";
import { LIBRARY_PICKER_COPY } from "@/components/product/media-copy";

interface MediaLibraryPickerProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Refs already in the gallery — marked, and a second tap takes them out again. */
  taken: ReadonlySet<string>;
  onPick: (asset: MediaAssetDto) => void;
  onUnpick: (asset: MediaAssetDto) => void;
  /** The tabs offered, in order; all three unless the surface wants fewer — a video's poster is a photograph (spec R8). */
  kinds?: readonly Kind[];
  title?: string;
  description?: string;
}

type Kind = MediaAssetDto["kind"];

const ALL_KINDS: readonly Kind[] = ["IMAGE", "VIDEO", "VIDEO_EMBED"];

const TABS: Record<Kind, { label: string; icon: IconName }> = {
  IMAGE: { label: "Photos", icon: "photos" },
  VIDEO: { label: "Videos", icon: "video" },
  VIDEO_EMBED: { label: "YouTube", icon: "youtube" },
};

/**
 * Reuse from the library (media-library spec R6): the org's ready photos and videos as the 3-up
 * grid, paged as you scroll, fetched when the sheet opens — a tap, so a route handler is the
 * right seam. A tap adds the asset's ref to the gallery and a second tap removes it; the link to
 * the asset row is made by URL on save (trd D1).
 */
export function MediaLibraryPicker({
  orgId,
  open,
  onOpenChange,
  taken,
  onPick,
  onUnpick,
  kinds = ALL_KINDS,
  title = LIBRARY_PICKER_COPY.title,
  description = "Tap to add to this gallery; tap again to take it out.",
}: MediaLibraryPickerProps) {
  const [kind, setKind] = useState<Kind>(kinds[0] ?? "IMAGE");
  return (
    <TaskDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width="gallery"
    >
      {/* One tab is no choice, so the row is left out rather than shown pressed. */}
      {kinds.length > 1 && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {kinds.map((tab) => {
            const { label, icon } = TABS[tab];
            return (
              <Button
                key={tab}
                type="button"
                size="sm"
                variant={kind === tab ? "default" : "outline"}
                onClick={() => setKind(tab)}
              >
                <Icon name={icon} className="mr-1" /> {label}
              </Button>
            );
          })}
        </div>
      )}
      {/* Mounted only while open, so nothing is fetched for a picker nobody has tapped. */}
      {open && (
        <PickerPages
          key={kind}
          orgId={orgId}
          kind={kind}
          taken={taken}
          onPick={onPick}
          onUnpick={onUnpick}
        />
      )}
    </TaskDialog>
  );
}

function PickerPages({
  orgId,
  kind,
  taken,
  onPick,
  onUnpick,
}: {
  orgId: string;
  kind: Kind;
  taken: ReadonlySet<string>;
  onPick: (asset: MediaAssetDto) => void;
  onUnpick: (asset: MediaAssetDto) => void;
}) {
  const { assets, loading, done, error, loadMore } = useMediaLibraryPages({
    orgId,
    query: `kind=${kind}`,
  });

  if (assets.length === 0 && done) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {kind === "IMAGE"
          ? LIBRARY_PICKER_COPY.noPhotos
          : kind === "VIDEO"
            ? LIBRARY_PICKER_COPY.noVideos
            : LIBRARY_PICKER_COPY.noYouTube}
      </p>
    );
  }

  return (
    <>
      {/* The tiles scroll, the dialog does not: a grid is the only part of this with more to see. */}
      <ul
        className={cn(PRODUCT_GRID_CLASSES, "min-h-0 flex-1 overflow-y-auto")}
      >
        {assets.map((asset) => {
          const isTaken = taken.has(asset.ref);
          return (
            <li key={asset.id}>
              <Button
                type="button"
                variant="ghost"
                aria-pressed={isTaken}
                onClick={() => (isTaken ? onUnpick(asset) : onPick(asset))}
                className="relative aspect-square h-auto w-full overflow-hidden rounded-card bg-muted p-0"
                aria-label={
                  isTaken
                    ? LIBRARY_PICKER_COPY.inGallery
                    : asset.kind === "IMAGE"
                      ? LIBRARY_PICKER_COPY.addPhoto
                      : LIBRARY_PICKER_COPY.addVideo
                }
              >
                {isTaken && (
                  <span className="absolute inset-0 z-10 flex items-center justify-center bg-scrim/40 text-hero-foreground">
                    <Icon name="done" size="lg" />
                  </span>
                )}
                {asset.kind === "VIDEO_EMBED" ? (
                  <YouTubePoster ref_={asset.ref} sizes={PRODUCT_TILE_SIZES} />
                ) : asset.kind === "VIDEO" ? (
                  // The poster once the worker has made one (video-hosting D7); a film mark while it is processing.
                  <>
                    {asset.poster && (
                      <NextImage
                        src={asset.poster}
                        alt=""
                        fill
                        sizes={PRODUCT_TILE_SIZES}
                        className="object-cover"
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-scrim/40 text-hero-foreground">
                      <Icon name="video" size="lg" />
                    </span>
                    {asset.state !== "READY" && (
                      <span className="absolute bottom-1 left-1 rounded-full bg-scrim/80 px-2 py-0.5 text-xs text-hero-foreground">
                        {asset.state === "FAILED" ? "Failed" : "Processing"}
                      </span>
                    )}
                  </>
                ) : (
                  <NextImage
                    src={asset.ref}
                    alt=""
                    fill
                    sizes={PRODUCT_TILE_SIZES}
                    className="object-cover"
                  />
                )}
              </Button>
            </li>
          );
        })}
      </ul>
      <LoadMore
        onMore={() => void loadMore()}
        done={done}
        loading={loading}
        error={error}
        count={assets.length}
        noun={
          kind === "IMAGE" ? "photos" : kind === "VIDEO" ? "videos" : "links"
        }
      />
    </>
  );
}
