"use client";

import NextImage from "next/image";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ZoomableImage } from "@/components/shared/zoomable-image";
import { VideoPlayer } from "@/components/product/video-player";
import { YouTubeEmbed } from "@/components/product/youtube-embed";
import { YouTubePoster } from "@/components/product/youtube-poster";
import { useHorizontalSwipe } from "@/hooks/core/useHorizontalSwipe";
import { useLibraryViewer } from "@/hooks/org/useLibraryViewer";
import { MediaDownloadButton } from "@/components/org/media-download-button";
import type { MediaAssetDto } from "@server/catalog/media-library.types";
import { MEDIA_VIEWER_COPY } from "./media-library-copy";

/** A neighbour peek and a strip thumbnail are both small, so one slot covers the two (ADR-0026). */
const THUMB_SIZES = "64px";
/** The current slide: the phone's width, and at most the viewer's own frame after that. */
const SLIDE_SIZES = "(min-width: 1024px) 70vw, 100vw";

interface LibraryViewerProps {
  orgId: string;
  /** The grid's list, in the grid's order under the filters in force (Q4). */
  assets: MediaAssetDto[];
  /** How many the library holds under those filters — what the counter counts against. */
  total: number;
  index: number;
  onIndexChange: (index: number) => void;
  onMore: () => void;
  done: boolean;
  loading: boolean;
  onClose: () => void;
  /** Hands the item being shown to the grid's side sheet (ux viewer ⓘ). */
  onDetails: (asset: MediaAssetDto) => void;
}

/**
 * One library item, full screen, and the rest of the library a swipe away (viewer spec R1–R6).
 *
 * The list is the grid's own, so what the seller flicks through is what they were just looking at;
 * this surface holds nothing but where in it they are (trd D9). Each slide renders by kind, and only
 * the current one mounts a player, so no iframe or video element loads for a slide out of view (D8).
 */
export function LibraryViewer({
  orgId,
  assets,
  total,
  index,
  onIndexChange,
  onMore,
  done,
  loading,
  onClose,
  onDetails,
}: LibraryViewerProps) {
  const { next, previous, go, hasFailed, markFailed, retry } = useLibraryViewer({
    count: assets.length,
    index,
    onIndexChange,
    onMore,
    done,
  });
  // A video's own controls are not a swipe, so the player stops the touch before it reaches here.
  const swipe = useHorizontalSwipe({ onNext: next, onPrevious: previous });

  const current = assets[index];
  if (!current) return null;

  const position = index + 1;
  const alt = MEDIA_VIEWER_COPY.slideAlt(position, total);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="fixed inset-0 top-0 left-0 z-50 h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex flex-col gap-0 overflow-hidden rounded-none border-0 bg-scrim/90 p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>

        <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Button
            type="button"
            variant="ghost"
            shape="icon"
            size="lg"
            onClick={() => onDetails(current)}
            className="rounded-full border border-primary/30 bg-scrim/80 text-hero-foreground hover:bg-hero/90"
            aria-label={MEDIA_VIEWER_COPY.details}
          >
            <Icon name="info" size="md" />
          </Button>
          <p className="text-small text-hero-foreground">{MEDIA_VIEWER_COPY.counter(position, total)}</p>
          <Button
            type="button"
            variant="ghost"
            shape="icon"
            size="lg"
            onClick={onClose}
            className="rounded-full border border-primary/30 bg-scrim/80 text-hero-foreground hover:bg-hero/90"
            aria-label={MEDIA_VIEWER_COPY.close}
          >
            <Icon name="close" size="md" />
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-stretch">
          {/* The neighbours, as a peek: enough to say there is more that way, at no cost but a thumbnail. */}
          <Peek asset={assets[index - 1]} side="left" />
          <Peek asset={assets[index + 1]} side="right" />

          <div className="min-w-0 flex-1 px-8 py-3 lg:px-24">
            {hasFailed(current.id) ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-card bg-muted/20 p-6 text-center">
                <Icon name="no-photo" size="xl" tone="muted" />
                <p className="text-small text-hero-foreground">{MEDIA_VIEWER_COPY.imageFailed}</p>
                <Button type="button" variant="outline" onClick={() => retry(current.id)}>
                  {MEDIA_VIEWER_COPY.tryAgain}
                </Button>
              </div>
            ) : (
              <Slide asset={current} alt={alt} swipe={swipe} onNext={next} onPrevious={previous} onFailed={() => markFailed(current.id)} />
            )}
          </div>

          {/* Arrows from md: a phone swipes (ADR-0050). */}
          <ViewerArrow side="left" onClick={previous} />
          <ViewerArrow side="right" onClick={next} />
        </div>

        <div className="flex shrink-0 flex-col gap-2 px-3 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {assets.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto sm:justify-center">
              {assets.map((asset, at) => (
                <Button
                  key={asset.id}
                  type="button"
                  variant="ghost"
                  onClick={() => go(at)}
                  aria-current={at === index}
                  aria-label={MEDIA_VIEWER_COPY.thumbnail(at + 1)}
                  className={`relative h-auto w-10 shrink-0 overflow-hidden rounded-field border p-0 aspect-square sm:w-12 ${
                    at === index ? "border-primary ring-2 ring-ring/30" : "border-border/70 opacity-70 hover:opacity-100"
                  }`}
                >
                  <Thumb asset={asset} />
                </Button>
              ))}
              {/* The next page on its way: the strip says so rather than ending without warning. */}
              {loading && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12">
                  <Spinner />
                </span>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <MediaDownloadButton orgId={orgId} asset={current} />
          </div>
          <p className="hidden text-center text-caption text-hero-foreground/70 lg:block">{MEDIA_VIEWER_COPY.hint}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SwipeHandlers = ReturnType<typeof useHorizontalSwipe>;

/** The current item by kind (trd D8). Nothing here is mounted for a slide out of view. */
function Slide({
  asset,
  alt,
  swipe,
  onNext,
  onPrevious,
  onFailed,
}: {
  asset: MediaAssetDto;
  alt: string;
  swipe: SwipeHandlers;
  onNext: () => void;
  onPrevious: () => void;
  onFailed: () => void;
}) {
  if (asset.kind === "IMAGE") {
    // Swipe and zoom are the same finger, so the stage decides which this was.
    return <ZoomableImage src={asset.ref} alt={alt} onSwipeNext={onNext} onSwipePrevious={onPrevious} onError={onFailed} />;
  }
  if (asset.kind === "VIDEO_EMBED") {
    return (
      <div className="flex h-full items-center" {...swipe}>
        <div className="relative aspect-video w-full overflow-hidden rounded-card bg-scrim">
          <YouTubeEmbed ref_={asset.ref} description={null} productName={alt} />
        </div>
      </div>
    );
  }
  const playable = asset.state === "READY" && asset.renditions.length > 0;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3" {...swipe}>
      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-muted/20">
        {playable ? (
          <VideoPlayer
            poster={asset.poster}
            renditions={asset.renditions}
            durationMs={asset.durationMs}
            title={alt}
            sizes={SLIDE_SIZES}
          />
        ) : (
          <>
            {asset.poster && <NextImage src={asset.poster} alt="" fill sizes={SLIDE_SIZES} className="object-contain" />}
            <span className="absolute inset-0 flex items-center justify-center bg-scrim/40 text-hero-foreground">
              <Icon name="video" size="xl" />
            </span>
          </>
        )}
      </div>
      {/* Why it is not playing, in the shop's words (ux Processing video, Terminal error). */}
      {!playable && asset.state === "FAILED" && asset.failureReason && (
        <p className="text-center text-small text-destructive">{MEDIA_VIEWER_COPY.failedVideo(asset.failureReason)}</p>
      )}
      {!playable && asset.state !== "FAILED" && (
        <div className="text-center text-hero-foreground">
          <p className="text-small font-medium">{MEDIA_VIEWER_COPY.processingTitle}</p>
          <p className="text-caption text-hero-foreground/70">{MEDIA_VIEWER_COPY.processingHint}</p>
        </div>
      )}
    </div>
  );
}

function Peek({ asset, side }: { asset: MediaAssetDto | undefined; side: "left" | "right" }) {
  if (!asset) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-field opacity-60 ${
        side === "left" ? "left-0" : "right-0"
      } h-24 w-7 lg:h-40 lg:w-16`}
    >
      <Thumb asset={asset} />
    </span>
  );
}

/** A thumbnail of any kind: the photograph, the video's poster, or the YouTube link's. */
function Thumb({ asset }: { asset: MediaAssetDto }) {
  if (asset.kind === "VIDEO_EMBED") return <YouTubePoster ref_={asset.ref} sizes={THUMB_SIZES} />;
  const src = asset.kind === "VIDEO" ? asset.poster : asset.ref;
  if (!src) {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-muted/30 text-hero-foreground">
        <Icon name="video" size="sm" />
      </span>
    );
  }
  return <NextImage src={src} alt="" fill sizes={THUMB_SIZES} className="object-cover" />;
}

function ViewerArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      shape="icon"
      size="lg"
      onClick={onClick}
      aria-label={side === "left" ? MEDIA_VIEWER_COPY.previous : MEDIA_VIEWER_COPY.next}
      className={`absolute top-1/2 hidden -translate-y-1/2 rounded-full border border-primary/30 bg-scrim/80 text-hero-foreground hover:bg-hero/90 md:flex ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <Icon name={side === "left" ? "previous" : "next"} size="md" />
    </Button>
  );
}
