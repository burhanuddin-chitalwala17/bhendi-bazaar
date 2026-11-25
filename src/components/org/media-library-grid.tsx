"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { YouTubeEmbed } from "@/components/product/youtube-embed";
import { VideoPlayer } from "@/components/product/video-player";
import { MediaLibraryPicker } from "@/components/product/media-library-picker";
import { LoadMore } from "@/components/shared/load-more";
import { useMediaLibraryPages } from "@/hooks/product/useMediaLibraryPages";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { orgMediaApiClient } from "@/components/org/orgMediaApiClient";
import { MediaDownloadButton } from "@/components/org/media-download-button";
import { LazyLibraryViewer } from "@/components/org/LazyLibraryViewer";
import {
  KIND_LABELS,
  LARGE_TILE_SIZES,
  MediaLibraryTile,
  MediaTile,
  STATE_BADGES,
} from "@/components/org/media-library-tile";
import { CropDialog } from "@/components/product/crop-dialog";
import { ImproveDialog } from "@/components/product/improve-dialog";
import { ImproveSplitButton } from "@/components/content/improve-split-button";
import { StyledShotDialog } from "@/components/content/styled-shot-dialog";
import type { AvailableTool } from "@server/content/enhancement.types";
import { LockedAction } from "@/components/subscriptions/locked-action";
import type { CropTransform } from "@/lib/image/crop-transform";
import { formatDay, formatDuration } from "@/lib/format";
import {
  MEDIA_TAG,
  MEDIA_TAGS,
  describeUses,
  type MediaAssetDto,
  type MediaTag,
  type MediaUseDto,
} from "@server/catalog/media-library.types";
import type { Pagination } from "@server/shared/pagination";
import { MEDIA_GRID_COPY, MEDIA_VIEWER_COPY } from "./media-library-copy";
import { FEATURE } from "@/components/subscriptions/features";

interface MediaLibraryGridProps {
  orgId: string;
  /** Names the upload folder for a reference picture from the device (improve-with-ai R4). */
  orgCode?: string | null;
  /** The first page, rendered on the server so the page paints full; the rest loads on scroll. */
  initial: { assets: MediaAssetDto[]; pagination: Pagination };
  /** The filters as a query string — what every further page is asked with. */
  query: string;
}

const SOURCE_LABELS: Record<MediaAssetDto["source"], string> = {
  UPLOAD: MEDIA_GRID_COPY.sourceUpload,
  DERIVED: MEDIA_GRID_COPY.sourceDerived,
  EMBED: MEDIA_GRID_COPY.sourceEmbed,
};

const formatBytes = (bytes: number | null) =>
  bytes === null ? "—" : bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const isVideoKind = (kind: MediaAssetDto["kind"]) => kind !== "IMAGE";

/**
 * The org's library as the 3-up grid every listing uses (ADR-0016), paged as you scroll, each
 * tile a tap target that opens a sheet with the asset's facts, its uses, and — when nothing uses
 * it — a retire action (media-library spec R6, R7). Uses are fetched when the sheet opens, one
 * asset at a time.
 */
export function MediaLibraryGrid({ orgId, orgCode, initial, query }: MediaLibraryGridProps) {
  const router = useRouter();
  const { assets, total, loading, done, error, loadMore, remove } = useMediaLibraryPages({ orgId, query, initial });
  const [open, setOpen] = useState<MediaAssetDto | null>(null);
  /** The photograph being reframed, if any. The one it came from stays exactly as it is (spec R8a). */
  const [reframing, setReframing] = useState<MediaAssetDto | null>(null);
  /** The photograph being improved (image-enhancement spec R2). No slot here: the library has none. */
  const [improving, setImproving] = useState<MediaAssetDto | null>(null);
  const [improveTool, setImproveTool] = useState<AvailableTool | null>(null);
  const [styling, setStyling] = useState<MediaAssetDto | null>(null);
  const [showUses, setShowUses] = useState(false);
  /** Which item the viewer is on, or null while it is closed (viewer trd D9). */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const tilesRef = useRef<HTMLUListElement>(null);
  // Stable, because the viewer asks for the next page from an effect that depends on it.
  const loadMoreForViewer = useCallback(() => void loadMore(), [loadMore]);
  const [isPosterPickerOpen, setPosterPickerOpen] = useState(false);

  const openId = open?.id ?? null;
  const loaded = useAsyncData((signal) => orgMediaApiClient.detail(orgId, openId!, signal), {
    enabled: openId !== null,
    refetchDependencies: [orgId, openId],
    onError: (cause) => toast.error(cause.message),
  });
  // Matched by id, so a reply for the asset opened before this one is never shown as this one's.
  const detail = loaded.data && loaded.data.asset.id === openId ? loaded.data : null;
  const uses = detail?.uses ?? [];

  const show = (asset: MediaAssetDto) => {
    loaded.reset();
    setOpen(asset);
    setShowUses(false);
  };

  // The photograph that stands in for a video, or null for the frame the worker cut (video-hosting
  // spec R8). The sheet shows the answer at once; the page re-reads so the tile follows.
  const posterMutation = useMutation(
    ({ video, posterAssetId }: { video: MediaAssetDto; posterAssetId: string | null }) =>
      orgMediaApiClient.setPoster(orgId, video.id, posterAssetId),
  );
  const savePoster = async (video: MediaAssetDto, posterAssetId: string | null) => {
    let saved: MediaAssetDto;
    try {
      saved = await posterMutation.mutate({ video, posterAssetId });
    } catch {
      return;
    }
    setOpen(saved);
    setPosterPickerOpen(false);
    toast.success(posterAssetId === null ? MEDIA_GRID_COPY.posterRestored : MEDIA_GRID_COPY.posterChanged);
    router.refresh();
  };

  // What the shop says a picture is for (ai-images/media-tags R6). The sheet shows the answer at
  // once; the page re-reads so a tag filter follows.
  const tagMutation = useMutation(
    ({ asset, tag, on }: { asset: MediaAssetDto; tag: MediaTag; on: boolean }) =>
      orgMediaApiClient.setTag(orgId, asset.id, tag, on),
    { errorMessage: MEDIA_GRID_COPY.tagFailed },
  );
  const toggleTag = async (asset: MediaAssetDto, tag: MediaTag) => {
    const on = !asset.tags.includes(tag);
    let saved: MediaAssetDto;
    try {
      saved = await tagMutation.mutate({ asset, tag, on });
    } catch {
      return;
    }
    setOpen(saved);
    toast.success((on ? MEDIA_GRID_COPY.tagAdded : MEDIA_GRID_COPY.tagRemoved)(MEDIA_GRID_COPY.tagLabel[tag]));
    router.refresh();
  };

  // A refusal is said, not greyed out: a disabled button with no reason is a dead end (spec R7, A3).
  // A crop of something already stored is cut where its bytes already are, and arrives as its own
  // picture beside the one it came from (trd D6a).
  const cropMutation = useMutation(
    ({ asset, transform }: { asset: MediaAssetDto; transform: CropTransform }) =>
      orgMediaApiClient.crop(orgId, asset.id, transform),
    {
      successMessage: MEDIA_GRID_COPY.cropped,
      onSuccess: () => {
        setReframing(null);
        setOpen(null);
        router.refresh();
      },
    },
  );
  const reframe = (asset: MediaAssetDto, transform: CropTransform) =>
    void cropMutation.mutate({ asset, transform }).catch(() => {});

  const retireMutation = useMutation((asset: MediaAssetDto) => orgMediaApiClient.retire(orgId, asset.id), {
    successMessage: MEDIA_GRID_COPY.retired,
  });

  const retire = async (asset: MediaAssetDto) => {
    if (detail === null) {
      toast.error(MEDIA_GRID_COPY.stillChecking);
      return;
    }
    if (uses.length > 0) {
      toast.error(MEDIA_GRID_COPY.stillUsed(describeUses(uses)));
      return;
    }
    if (!confirm(MEDIA_GRID_COPY.confirmRetire)) return;
    try {
      await retireMutation.mutate(asset);
    } catch {
      return;
    }
    setOpen(null);
    remove(asset.id);
    router.refresh();
  };

  const isSavingPoster = posterMutation.isLoading;
  const isCropping = cropMutation.isLoading;
  const isRetiring = retireMutation.isLoading;

  if (assets.length === 0 && done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="photos" size="xl" tone="muted" />
          <p className="text-sm text-muted-foreground">
            {new URLSearchParams(query).get("tag") === MEDIA_TAG.REFERENCE ? MEDIA_GRID_COPY.noReferences : MEDIA_GRID_COPY.empty}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{MEDIA_GRID_COPY.itemCount(total)}</p>
      <ul className={PRODUCT_GRID_CLASSES} ref={tilesRef}>
        {assets.map((asset, at) => (
          <li key={asset.id}>
            <MediaLibraryTile asset={asset} onOpen={() => show(asset)} onFullScreen={() => setViewerIndex(at)} />
          </li>
        ))}
      </ul>

      <LoadMore onMore={() => void loadMore()} done={done} loading={loading} error={error} count={assets.length} noun={MEDIA_GRID_COPY.loadMoreNoun} />

      <Sheet open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <SheetContent side="adaptive">
          {open && (
            <>
              <SheetTitle>{KIND_LABELS[open.kind]}</SheetTitle>
              <SheetDescription>{SOURCE_LABELS[open.source]}</SheetDescription>
              <div
                className={`relative w-full overflow-hidden rounded-card bg-muted ${
                  isVideoKind(open.kind) ? "aspect-video" : "aspect-square"
                }`}
              >
                {open.kind === "VIDEO_EMBED" ? (
                  <YouTubeEmbed ref_={open.ref} description={null} productName={MEDIA_GRID_COPY.libraryName} />
                ) : open.kind === "VIDEO" && open.state === "READY" && open.renditions.length > 0 ? (
                  <VideoPlayer
                    poster={open.poster}
                    renditions={open.renditions}
                    durationMs={open.durationMs}
                    title={MEDIA_GRID_COPY.videoTitle}
                    sizes={LARGE_TILE_SIZES}
                  />
                ) : (
                  <MediaTile asset={open} large />
                )}
              </div>
              {/* Offered on a retired item too: its file is kept for thirty days (viewer Q10). */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const at = assets.findIndex((asset) => asset.id === open.id);
                    if (at >= 0) setViewerIndex(at);
                  }}
                >
                  <Icon name="fullscreen" className="mr-2" />
                  {MEDIA_VIEWER_COPY.viewFullImage}
                </Button>
                <MediaDownloadButton orgId={orgId} asset={open} />
              </div>
              {open.kind === "VIDEO" && open.state !== "RETIRED" && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setPosterPickerOpen(true)} pending={isSavingPoster}>
                    {!isSavingPoster && <Icon name="photo" className="mr-2" />}
                    {MEDIA_GRID_COPY.changePoster}
                  </Button>
                  {/* Only where there is a choice to undo: with no photograph standing in, this
                      would put back the frame that is already showing. */}
                  {open.posterChosen && (
                    <Button type="button" variant="ghost" onClick={() => void savePoster(open, null)} pending={isSavingPoster}>
                      {!isSavingPoster && <Icon name="undo" className="mr-2" />}
                      {MEDIA_GRID_COPY.ownFrame}
                    </Button>
                  )}
                  <MediaLibraryPicker
                    orgId={orgId}
                    open={isPosterPickerOpen}
                    onOpenChange={setPosterPickerOpen}
                    kinds={["IMAGE"]}
                    title={MEDIA_GRID_COPY.choosePoster}
                    description={MEDIA_GRID_COPY.choosePosterHint}
                    taken={new Set(open.poster ? [open.poster] : [])}
                    onPick={(photo) => void savePoster(open, photo.id)}
                    onUnpick={() => void savePoster(open, null)}
                  />
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{MEDIA_GRID_COPY.size}</dt>
                <dd>{open.width && open.height ? `${open.width} × ${open.height}` : "—"}</dd>
                <dt className="text-muted-foreground">{MEDIA_GRID_COPY.file}</dt>
                <dd>{formatBytes(open.bytes)}{open.mimeType ? ` · ${open.mimeType.replace(/^(image|video)\//, "")}` : ""}</dd>
                {open.durationMs !== null && (
                  <>
                    <dt className="text-muted-foreground">{MEDIA_GRID_COPY.duration}</dt>
                    <dd>{formatDuration(open.durationMs)}</dd>
                  </>
                )}
                {STATE_BADGES[open.state] && (
                  <>
                    <dt className="text-muted-foreground">{MEDIA_GRID_COPY.status}</dt>
                    <dd>
                      {STATE_BADGES[open.state]?.label}
                      {/* The reason is what the org member acts on (spec R7): a limit named, or a file no decoder read. */}
                      {open.failureReason && <span className="block text-destructive">{open.failureReason}</span>}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">{MEDIA_GRID_COPY.added}</dt>
                <dd>{formatDay(open.createdAt)}</dd>
                {open.retiredAt && (
                  <>
                    <dt className="text-muted-foreground">{MEDIA_GRID_COPY.retiredOn}</dt>
                    <dd>{formatDay(open.retiredAt)}</dd>
                  </>
                )}
              </dl>
              {/* A shop has to be able to read why its picture went without an admin to ask
                  (spec R12): the reason is on the asset, not only in the audit trail. */}
              {open.retiredBy === "PLATFORM" && (
                <p className="rounded-field bg-destructive/10 p-3 text-sm text-destructive">
                  {MEDIA_GRID_COPY.takenDown}
                  {open.retiredReason ? `: ${open.retiredReason}` : "."}
                </p>
              )}
              {open.kind === "IMAGE" && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">{MEDIA_GRID_COPY.tags}</h3>
                  <div className="flex flex-wrap gap-2">
                    {open.state === "RETIRED"
                      ? // A retired picture's tags are a record, not a choice: shown, not offered.
                        open.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">{MEDIA_GRID_COPY.tagLabel[tag]}</Badge>
                        ))
                      : MEDIA_TAGS.map((tag) => (
                          <Button
                            key={tag}
                            type="button"
                            size="sm"
                            variant={open.tags.includes(tag) ? "default" : "outline"}
                            aria-pressed={open.tags.includes(tag)}
                            onClick={() => toggleTag(open, tag)}
                          >
                            {MEDIA_GRID_COPY.tagLabel[tag]}
                          </Button>
                        ))}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <h3 className="text-sm font-medium">{MEDIA_GRID_COPY.usedBy}</h3>
                {detail === null ? (
                  <p className="text-sm text-muted-foreground">{MEDIA_GRID_COPY.looking}</p>
                ) : uses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{MEDIA_GRID_COPY.nowhere}</p>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-auto px-2 py-1 font-normal"
                      onClick={() => setShowUses((current) => !current)}
                      aria-expanded={showUses}
                    >
                      <span className="capitalize">{describeUses(uses)}</span>
                      <Icon name={showUses ? "collapse" : "expand"} className="ml-1" />
                    </Button>
                    {showUses && (
                      <ul className="space-y-1 pl-2 text-sm">
                        {uses.map((use) => (
                          <li key={`${use.kind}-${use.id}-${use.slot ?? ""}`}>
                            <UseLine use={use} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              {/* Lineage, not a use (trd D6a): nothing on a screen breaks when this one leaves, but
                  its file is kept while a picture made from it exists. A video's own derivatives are
                  its playable copies and its poster — machinery the library hides — so saying a
                  number here would expose the plumbing and read as something the shop had made. */}
              {open.kind !== "VIDEO" && open.derivedCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {MEDIA_GRID_COPY.derived(open.derivedCount)}
                  {MEDIA_GRID_COPY.derivedKept}
                </p>
              )}

              {open.state !== "RETIRED" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {open.kind === "IMAGE" && (
                    <>
                      <LockedAction feature={FEATURE.IMAGE_ENHANCEMENT} label={MEDIA_GRID_COPY.improve} variant="outline">
                        <ImproveSplitButton
                          size="default"
                          onAi={() => setStyling(open)}
                          onTool={(tool) => {
                            setImproveTool(tool);
                            setImproving(open);
                          }}
                        />
                      </LockedAction>
                      <Button type="button" variant="outline" onClick={() => setReframing(open)}>
                        <Icon name="crop" className="mr-2" />
                        {MEDIA_GRID_COPY.crop}
                      </Button>
                    </>
                  )}
                  <Button type="button" variant="outline" onClick={() => retire(open)} pending={isRetiring}>
                    {!isRetiring && <Icon name="archive" className="mr-2" />}
                    {isRetiring ? MEDIA_GRID_COPY.retiring : MEDIA_GRID_COPY.retire}
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Accepting adds the improved picture beside the one it came from; there is no row here to
          take it over, so the grid simply re-reads (spec R3). */}
      <ImproveDialog
        orgId={orgId}
        target={improving ? { ref: improving.ref, assetId: improving.id } : null}
        preselect={improveTool}
        onAccepted={() => {
          setImproving(null);
          setOpen(null);
          router.refresh();
        }}
        onClose={() => {
          setImproving(null);
          setImproveTool(null);
        }}
      />

      {/* Every AI picture is already in the library when it is shown (ai-images Q25): "Use this" closes and re-reads. */}
      <StyledShotDialog
        orgId={orgId}
        orgCode={orgCode}
        target={styling ? { ref: styling.ref, assetId: styling.id } : null}
        onUse={() => {
          setOpen(null);
          router.refresh();
        }}
        onClose={() => setStyling(null)}
      />

      {/* Closing returns to where it was opened from, scrolled to the item last shown (viewer Q11). */}
      <LazyLibraryViewer
        orgId={orgId}
        assets={assets}
        total={total}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onMore={loadMoreForViewer}
        done={done}
        loading={loading}
        onClose={() => {
          const at = viewerIndex;
          setViewerIndex(null);
          if (at !== null) tilesRef.current?.children[at]?.scrollIntoView({ block: "center" });
        }}
        onDetails={(asset) => {
          setViewerIndex(null);
          show(asset);
        }}
      />

      <CropDialog
        photo={reframing ? { id: reframing.id, src: reframing.ref } : null}
        remaining={0}
        busy={isCropping}
        canUseAsIs={false}
        onUseAsIs={() => setReframing(null)}
        onUseCrop={(transform) => void (reframing && reframe(reframing, transform))}
        onUseAllAsIs={() => setReframing(null)}
        onCancel={() => setReframing(null)}
      />
    </div>
  );
}

function UseLine({ use }: { use: MediaUseDto }) {
  const where: Record<MediaUseDto["kind"], string> = {
    product: MEDIA_GRID_COPY.useProduct,
    category: MEDIA_GRID_COPY.useCategory,
    "storefront-logo": MEDIA_GRID_COPY.useStorefront,
    "storefront-hero": MEDIA_GRID_COPY.useStorefront,
    "storefront-collection": MEDIA_GRID_COPY.useStorefront,
    "storefront-banner": MEDIA_GRID_COPY.useStorefrontBanner,
    "home-banner": MEDIA_GRID_COPY.useHomeBanner,
    "video-poster": MEDIA_GRID_COPY.useVideoPoster,
  };
  return (
    <span>
      <span className="text-muted-foreground">{where[use.kind]}: </span>
      {use.label}
      {use.slot && <span className="text-muted-foreground">{MEDIA_GRID_COPY.slot(use.slot)}</span>}
    </span>
  );
}
