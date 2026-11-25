"use client";

import NextImage from "next/image";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRODUCT_TILE_SIZES } from "@/components/shared/product-card";
import { YouTubePoster } from "@/components/product/youtube-poster";
import { formatDuration } from "@/lib/format";
import { MEDIA_TAG, type MediaAssetDto } from "@server/catalog/media-library.types";
import { cn } from "@/lib/utils";
import { MEDIA_BULK_COPY, MEDIA_GRID_COPY, MEDIA_VIEWER_COPY } from "./media-library-copy";

/** The sheet's preview: the panel's width from `md`, the phone's otherwise (ADR-0026). */
export const LARGE_TILE_SIZES = "(min-width: 768px) 384px, 100vw";

export const KIND_LABELS: Record<MediaAssetDto["kind"], string> = {
  IMAGE: MEDIA_GRID_COPY.kindImage,
  VIDEO_EMBED: MEDIA_GRID_COPY.kindEmbed,
  VIDEO: MEDIA_GRID_COPY.kindVideo,
};

/** A hosted video's readiness, as the tile says it (video-hosting D7); nothing for a state with nothing to say. */
export const STATE_BADGES: Partial<Record<MediaAssetDto["state"], { label: string; variant: "outline" | "destructive" }>> = {
  PROCESSING: { label: MEDIA_GRID_COPY.stateProcessing, variant: "outline" },
  FAILED: { label: MEDIA_GRID_COPY.stateFailed, variant: "destructive" },
};

const isVideoKind = (kind: MediaAssetDto["kind"]) => kind !== "IMAGE";

interface MediaLibraryTileProps {
  asset: MediaAssetDto;
  /** The tile itself: the item's facts in the side sheet. */
  onOpen: () => void;
  /** The ⤢ control: the same item, full screen (viewer R2, Q2). */
  onFullScreen: () => void;
  /** In selection mode: a tap ticks instead of opening, and the tick takes the ⤢'s corner (bulk-actions R1). */
  selection?: { selected: boolean; onToggle: () => void };
  /** Outside the mode, from `lg`: the tick shown on hover, which starts the mode with this tile (Q7). */
  onSelect?: () => void;
}

/**
 * One library tile: the picture, what the shop needs to know at a glance, and the two ways in —
 * the tile opens the side sheet, the ⤢ control opens the viewer (viewer spec R2).
 *
 * The control sits top-left and a state badge moves below it (viewer Q7): the use count keeps the
 * top-right corner, where the eye already goes for it.
 */
export function MediaLibraryTile({ asset, onOpen, onFullScreen, selection, onSelect }: MediaLibraryTileProps) {
  const state = STATE_BADGES[asset.state];
  const label = isVideoKind(asset.kind)
    ? KIND_LABELS[asset.kind]
    : MEDIA_GRID_COPY.photoLabel(asset.width ?? "?", asset.height ?? "?");
  return (
    <div className="group relative">
      <Button
        type="button"
        variant="ghost"
        onClick={selection ? selection.onToggle : onOpen}
        aria-pressed={selection ? selection.selected : undefined}
        className={cn(
          "relative aspect-square h-auto w-full overflow-hidden rounded-card bg-muted p-0",
          selection?.selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
        aria-label={label}
      >
        <MediaTile asset={asset} />
        {/* Only a count, and only where there is one: most of a library is used nowhere yet,
            and a badge on all of it says nothing. The Usage filter is how they are found. */}
        {asset.uses > 0 && (
          <Badge className={cn("absolute right-1 top-1", onSelect && !selection && "lg:group-hover:hidden lg:group-focus-within:hidden")}>
            {MEDIA_GRID_COPY.useCount(asset.uses)}
          </Badge>
        )}
        {selection && <Tick selected={selection.selected} className="absolute left-2.5 top-2.5" />}
        {state && (
          <Badge className="absolute left-1 top-13" variant={state.variant}>
            {state.label}
          </Badge>
        )}
        {/* Only on a reference that is nothing else (media-tags ux): a product photo also used as a reference is still a product photo. */}
        {asset.tags.includes(MEDIA_TAG.REFERENCE) && !asset.tags.includes(MEDIA_TAG.PRODUCT) && (
          <Badge className="absolute bottom-1 left-1" variant="secondary">
            {MEDIA_GRID_COPY.tagLabel.REFERENCE}
          </Badge>
        )}
        {asset.durationMs !== null && (
          <Badge className="absolute bottom-1 right-1" variant="secondary">
            {formatDuration(asset.durationMs)}
          </Badge>
        )}
      </Button>
      {/* Outside the tile's own button, because a button inside a button is not a control. */}
      {!selection && (
        <Button
          type="button"
          variant="ghost"
          shape="icon"
          onClick={onFullScreen}
          aria-label={MEDIA_VIEWER_COPY.fullScreen}
          // 44px: the grid's tiles are small on a phone, and ux.md asks this target be a full 44 (no icon step has one).
          className="absolute left-1 top-1 size-11 rounded-full border border-primary/30 bg-scrim/70 text-hero-foreground hover:bg-hero/90"
        >
          <Icon name="fullscreen" size="md" />
        </Button>
      )}
      {/* Top-right, over the use count, because the ⤢ keeps the top-left until the mode starts. */}
      {!selection && onSelect && (
        <Button
          type="button"
          variant="ghost"
          shape="icon"
          onClick={onSelect}
          aria-label={MEDIA_BULK_COPY.selectItem(label)}
          className="absolute right-1 top-1 hidden size-11 rounded-full hover:bg-transparent lg:group-hover:flex lg:group-focus-within:flex"
        >
          <Tick selected={false} />
        </Button>
      )}
    </div>
  );
}

/** The selection mark: a ringed circle, filled with a check once ticked. */
function Tick({ selected, className }: { selected: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full border-2 border-background shadow-raised",
        selected ? "bg-primary text-primary-foreground" : "bg-scrim/50",
        className,
      )}
    >
      {selected && <Icon name="done" size="sm" />}
    </span>
  );
}

/**
 * A photo at its stored width (ADR-0075); a video as its poster, marked so it reads as one. A hosted video
 * has a poster only once the worker has made it (video-hosting D7); before that, and after a
 * failure, the tile is a film mark and the badge says which.
 */
export function MediaTile({ asset, large = false }: { asset: MediaAssetDto; large?: boolean }) {
  const sizes = large ? LARGE_TILE_SIZES : PRODUCT_TILE_SIZES;
  if (asset.kind === "VIDEO_EMBED") {
    return <YouTubePoster ref_={asset.ref} sizes={sizes} />;
  }
  if (asset.kind === "VIDEO") {
    return (
      <>
        {asset.poster && <NextImage src={asset.poster} alt="" fill sizes={sizes} className="object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center bg-scrim/40 text-hero-foreground">
          <Icon name="video" size={large ? "xl" : "lg"} />
        </span>
      </>
    );
  }
  return <NextImage src={asset.ref} alt="" fill sizes={sizes} className="object-cover" />;
}
