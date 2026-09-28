"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { toast } from "sonner";
import { Archive, ChevronDown, ChevronUp, Crop, Film, ImageIcon, Images, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { PRODUCT_TILE_SIZES } from "@/components/shared/product-card";
import { YouTubeEmbed } from "@/components/product/youtube-embed";
import { YouTubePoster } from "@/components/product/youtube-poster";
import { VideoPlayer } from "@/components/product/video-player";
import { MediaLibraryPicker } from "@/components/product/media-library-picker";
import { LoadMore } from "@/components/shared/load-more";
import { useMediaLibraryPages } from "@/hooks/product/useMediaLibraryPages";
import { readApiError } from "@/lib/api-error";
import { CropDialog } from "@/components/product/crop-dialog";
import { ImproveDialog } from "@/components/product/improve-dialog";
import type { CropTransform } from "@/lib/image/crop-transform";
import { formatDay, formatDuration } from "@/lib/format";
import { describeUses, type MediaAssetDetailDto, type MediaAssetDto, type MediaUseDto } from "@server/catalog/media-library.types";
import type { Pagination } from "@server/shared/pagination";

interface MediaLibraryGridProps {
  orgId: string;
  /** The first page, rendered on the server so the page paints full; the rest loads on scroll. */
  initial: { assets: MediaAssetDto[]; pagination: Pagination };
  /** The filters as a query string — what every further page is asked with. */
  query: string;
}

const SOURCE_LABELS: Record<MediaAssetDto["source"], string> = {
  UPLOAD: "Uploaded",
  DERIVED: "Made from another item",
  EMBED: "Video link",
};

const KIND_LABELS: Record<MediaAssetDto["kind"], string> = {
  IMAGE: "Photo",
  VIDEO_EMBED: "Video link",
  VIDEO: "Video",
};

/** A hosted video's readiness, as the tile says it (video-hosting D7); nothing for a state with nothing to say. */
const STATE_BADGES: Partial<Record<MediaAssetDto["state"], { label: string; variant: "outline" | "destructive" }>> = {
  PROCESSING: { label: "Processing", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
};

const formatBytes = (bytes: number | null) =>
  bytes === null ? "—" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const isVideoKind = (kind: MediaAssetDto["kind"]) => kind !== "IMAGE";

/**
 * The org's library as the 3-up grid every listing uses (ADR-0016), paged as you scroll, each
 * tile a tap target that opens a sheet with the asset's facts, its uses, and — when nothing uses
 * it — a retire action (media-library spec R6, R7). Uses are fetched when the sheet opens, one
 * asset at a time.
 */
export function MediaLibraryGrid({ orgId, initial, query }: MediaLibraryGridProps) {
  const router = useRouter();
  const { assets, total, loading, done, error, loadMore, remove } = useMediaLibraryPages({ orgId, query, initial });
  const [open, setOpen] = useState<MediaAssetDto | null>(null);
  const [detail, setDetail] = useState<MediaAssetDetailDto | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  /** The photograph being reframed, if any. The one it came from stays exactly as it is (spec R8a). */
  const [reframing, setReframing] = useState<MediaAssetDto | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  /** The photograph being improved (image-enhancement spec R2). No slot here: the library has none. */
  const [improving, setImproving] = useState<MediaAssetDto | null>(null);
  const [showUses, setShowUses] = useState(false);
  const [isPosterPickerOpen, setPosterPickerOpen] = useState(false);
  const [isSavingPoster, setIsSavingPoster] = useState(false);
  const uses = detail?.uses ?? [];

  const show = async (asset: MediaAssetDto) => {
    setOpen(asset);
    setDetail(null);
    setShowUses(false);
    const response = await fetch(`/api/org/${orgId}/media/${asset.id}`);
    if (!response.ok) {
      toast.error((await readApiError(response)).message);
      return;
    }
    setDetail((await response.json()) as MediaAssetDetailDto);
  };

  // The photograph that stands in for a video, or null for the frame the worker cut (video-hosting
  // spec R8). The sheet shows the answer at once; the page re-reads so the tile follows.
  const savePoster = async (video: MediaAssetDto, posterAssetId: string | null) => {
    setIsSavingPoster(true);
    try {
      const response = await fetch(`/api/org/${orgId}/media/${video.id}/poster`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ posterAssetId }),
      });
      if (!response.ok) {
        toast.error((await readApiError(response)).message);
        return;
      }
      setOpen((await response.json()) as MediaAssetDto);
      setPosterPickerOpen(false);
      toast.success(posterAssetId === null ? "The video shows its own frame again" : "Poster changed");
      router.refresh();
    } finally {
      setIsSavingPoster(false);
    }
  };

  // A refusal is said, not greyed out: a disabled button with no reason is a dead end (spec R7, A3).
  // A crop of something already stored is cut where its bytes already are, and arrives as its own
  // picture beside the one it came from (trd D6a).
  const reframe = async (asset: MediaAssetDto, transform: CropTransform) => {
    setIsCropping(true);
    try {
      const response = await fetch(`/api/org/${orgId}/media/${asset.id}/crop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(transform),
      });
      if (!response.ok) {
        toast.error((await readApiError(response)).message);
        return;
      }
      toast.success("Cropped. The photo you started from is untouched.");
      setReframing(null);
      setOpen(null);
      router.refresh();
    } finally {
      setIsCropping(false);
    }
  };

  const retire = async (asset: MediaAssetDto) => {
    if (detail === null) {
      toast.error("Still checking where this image is used. Try again in a moment.");
      return;
    }
    if (uses.length > 0) {
      toast.error(`This image is still used by ${describeUses(uses)}. Remove it there first.`);
      return;
    }
    if (!confirm("Retire this image? It leaves the library now and its file is deleted after thirty days.")) return;
    setIsRetiring(true);
    try {
      const response = await fetch(`/api/org/${orgId}/media/${asset.id}/retire`, { method: "POST" });
      if (!response.ok) {
        toast.error((await readApiError(response)).message);
        return;
      }
      toast.success("Image retired");
      setOpen(null);
      remove(asset.id);
      router.refresh();
    } finally {
      setIsRetiring(false);
    }
  };

  if (assets.length === 0 && done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Images className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Photos you upload to a product, a banner or your storefront appear
            in this library.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {total} item{total === 1 ? "" : "s"}
      </p>
      <ul className={PRODUCT_GRID_CLASSES}>
        {assets.map((asset) => (
          <li key={asset.id}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void show(asset)}
              className="relative aspect-square h-auto w-full overflow-hidden rounded-card bg-muted p-0"
              aria-label={isVideoKind(asset.kind) ? KIND_LABELS[asset.kind] : `Photo ${asset.width ?? "?"} by ${asset.height ?? "?"}`}
            >
              <MediaTile asset={asset} />
              {/* Only a count, and only where there is one: most of a library is used nowhere yet,
                  and a badge on all of it says nothing. The Usage filter is how they are found. */}
              {asset.uses > 0 && (
                <Badge className="absolute right-1 top-1">
                  {asset.uses} use{asset.uses === 1 ? "" : "s"}
                </Badge>
              )}
              {STATE_BADGES[asset.state] && (
                <Badge className="absolute left-1 top-1" variant={STATE_BADGES[asset.state]?.variant}>
                  {STATE_BADGES[asset.state]?.label}
                </Badge>
              )}
              {asset.durationMs !== null && (
                <Badge className="absolute bottom-1 right-1" variant="secondary">
                  {formatDuration(asset.durationMs)}
                </Badge>
              )}
            </Button>
          </li>
        ))}
      </ul>

      <LoadMore onMore={() => void loadMore()} done={done} loading={loading} error={error} count={assets.length} noun="items" />

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
                  <YouTubeEmbed ref_={open.ref} description={null} productName="this library" />
                ) : open.kind === "VIDEO" && open.state === "READY" && open.renditions.length > 0 ? (
                  <VideoPlayer
                    poster={open.poster}
                    renditions={open.renditions}
                    durationMs={open.durationMs}
                    title="this video"
                    sizes={LARGE_TILE_SIZES}
                  />
                ) : (
                  <MediaTile asset={open} large />
                )}
              </div>
              {open.kind === "VIDEO" && open.state !== "RETIRED" && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setPosterPickerOpen(true)} disabled={isSavingPoster}>
                    <ImageIcon className="mr-2 size-4" />
                    Change poster
                  </Button>
                  {/* Only where there is a choice to undo: with no photograph standing in, this
                      would put back the frame that is already showing. */}
                  {open.posterChosen && (
                    <Button type="button" variant="ghost" onClick={() => void savePoster(open, null)} disabled={isSavingPoster}>
                      <RotateCcw className="mr-2 size-4" />
                      Use the video&apos;s own frame
                    </Button>
                  )}
                  <MediaLibraryPicker
                    orgId={orgId}
                    open={isPosterPickerOpen}
                    onOpenChange={setPosterPickerOpen}
                    kinds={["IMAGE"]}
                    title="Choose a poster"
                    description="The photograph that stands in for this video until it plays. Tap the current one to go back to the video's own frame."
                    taken={new Set(open.poster ? [open.poster] : [])}
                    onPick={(photo) => void savePoster(open, photo.id)}
                    onUnpick={() => void savePoster(open, null)}
                  />
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Size</dt>
                <dd>{open.width && open.height ? `${open.width} × ${open.height}` : "—"}</dd>
                <dt className="text-muted-foreground">File</dt>
                <dd>{formatBytes(open.bytes)}{open.mimeType ? ` · ${open.mimeType.replace(/^(image|video)\//, "")}` : ""}</dd>
                {open.durationMs !== null && (
                  <>
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd>{formatDuration(open.durationMs)}</dd>
                  </>
                )}
                {STATE_BADGES[open.state] && (
                  <>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      {STATE_BADGES[open.state]?.label}
                      {/* The reason is what the org member acts on (spec R7): a limit named, or a file no decoder read. */}
                      {open.failureReason && <span className="block text-destructive">{open.failureReason}</span>}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Added</dt>
                <dd>{formatDay(open.createdAt)}</dd>
                {open.retiredAt && (
                  <>
                    <dt className="text-muted-foreground">Retired</dt>
                    <dd>{formatDay(open.retiredAt)}</dd>
                  </>
                )}
              </dl>
              {/* A shop has to be able to read why its picture went without an admin to ask
                  (spec R12): the reason is on the asset, not only in the audit trail. */}
              {open.retiredBy === "PLATFORM" && (
                <p className="rounded-field bg-destructive/10 p-3 text-sm text-destructive">
                  Taken down by Bhendi Bazaar
                  {open.retiredReason ? `: ${open.retiredReason}` : "."}
                </p>
              )}
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Used by</h3>
                {detail === null ? (
                  <p className="text-sm text-muted-foreground">Looking…</p>
                ) : uses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nowhere. This can be retired.</p>
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
                      {showUses ? <ChevronUp className="ml-1 size-4" aria-hidden /> : <ChevronDown className="ml-1 size-4" aria-hidden />}
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
                  {open.derivedCount} picture{open.derivedCount === 1 ? " was" : "s were"} made from this one.
                  {" "}It stays in storage for them even after it leaves the library.
                </p>
              )}

              {open.state !== "RETIRED" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  {open.kind === "IMAGE" && (
                    <>
                      <Button type="button" variant="outline" onClick={() => setImproving(open)}>
                        <Sparkles className="mr-2 size-4" />
                        Improve
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setReframing(open)}>
                        <Crop className="mr-2 size-4" />
                        Crop
                      </Button>
                    </>
                  )}
                  <Button type="button" variant="outline" onClick={() => retire(open)} disabled={isRetiring}>
                    <Archive className="mr-2 size-4" />
                    {isRetiring ? "Retiring…" : "Retire"}
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
        onAccepted={() => {
          setImproving(null);
          setOpen(null);
          router.refresh();
        }}
        onClose={() => setImproving(null)}
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

/**
 * A photo through the optimizer; a video as its poster, marked so it reads as one. A hosted video
 * has a poster only once the worker has made it (video-hosting D7); before that, and after a
 * failure, the tile is a film mark and the badge says which.
 */
/** The sheet's preview: the panel's width from `md`, the phone's otherwise (ADR-0026). */
const LARGE_TILE_SIZES = "(min-width: 768px) 384px, 100vw";

function MediaTile({ asset, large = false }: { asset: MediaAssetDto; large?: boolean }) {
  const sizes = large ? LARGE_TILE_SIZES : PRODUCT_TILE_SIZES;
  if (asset.kind === "VIDEO_EMBED") {
    return <YouTubePoster ref_={asset.ref} sizes={sizes} />;
  }
  if (asset.kind === "VIDEO") {
    return (
      <>
        {asset.poster && <NextImage src={asset.poster} alt="" fill sizes={sizes} className="object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center bg-scrim/40">
          <Film className={`${large ? "size-10" : "size-6"} text-hero-foreground`} aria-hidden />
        </span>
      </>
    );
  }
  return <NextImage src={asset.ref} alt="" fill sizes={sizes} className="object-cover" />;
}

function UseLine({ use }: { use: MediaUseDto }) {
  const where: Record<MediaUseDto["kind"], string> = {
    product: "Product",
    category: "Category",
    "storefront-logo": "Storefront",
    "storefront-hero": "Storefront",
    "storefront-banner": "Storefront banner",
    "home-banner": "Home banner",
    "video-poster": "Video",
  };
  return (
    <span>
      <span className="text-muted-foreground">{where[use.kind]}: </span>
      {use.label}
      {use.slot && <span className="text-muted-foreground"> · {use.slot} slot</span>}
    </span>
  );
}
