"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { toast } from "sonner";
import { Archive, ChevronDown, ChevronUp, Film, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { PRODUCT_TILE_SIZES } from "@/components/shared/product-card";
import { YouTubeEmbed } from "@/components/product/youtube-embed";
import { YouTubePoster } from "@/components/product/youtube-poster";
import { LoadMore } from "@/components/shared/load-more";
import { useMediaLibraryPages } from "@/hooks/product/useMediaLibraryPages";
import { readApiError } from "@/lib/api-error";
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

/** "1:05" for a hosted video's playing time. */
const formatDuration = (durationMs: number) => {
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

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
  const [showUses, setShowUses] = useState(false);
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

  // A refusal is said, not greyed out: a disabled button with no reason is a dead end (spec R7, A3).
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
              <Badge className="absolute right-1 top-1" variant={asset.uses > 0 ? "default" : "outline"}>
                {asset.uses > 0 ? `${asset.uses} use${asset.uses === 1 ? "" : "s"}` : "unused"}
              </Badge>
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
                ) : (
                  <MediaTile asset={open} large />
                )}
              </div>
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
                <dd>{new Date(open.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</dd>
                {open.retiredAt && (
                  <>
                    <dt className="text-muted-foreground">Retired</dt>
                    <dd>{new Date(open.retiredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</dd>
                  </>
                )}
              </dl>
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Used by</h3>
                {detail === null ? (
                  <p className="text-sm text-muted-foreground">Looking…</p>
                ) : uses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing. This can be retired.</p>
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
              {open.state !== "RETIRED" && (
                <Button type="button" variant="outline" onClick={() => retire(open)} disabled={isRetiring}>
                  <Archive className="mr-2 size-4" />
                  {isRetiring ? "Retiring…" : "Retire"}
                </Button>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * A photo through the optimizer; a video as its poster, marked so it reads as one. A hosted video
 * has a poster only once the worker has made it (video-hosting D7); before that, and after a
 * failure, the tile is a film mark and the badge says which.
 */
function MediaTile({ asset, large = false }: { asset: MediaAssetDto; large?: boolean }) {
  const sizes = large ? "(min-width: 768px) 384px, 100vw" : PRODUCT_TILE_SIZES;
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
    derived: "Derived",
  };
  return (
    <span>
      <span className="text-muted-foreground">{where[use.kind]}: </span>
      {use.label}
      {use.slot && <span className="text-muted-foreground"> · {use.slot} slot</span>}
    </span>
  );
}
