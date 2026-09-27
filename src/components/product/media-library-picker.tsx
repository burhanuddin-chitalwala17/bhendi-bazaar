import { useState } from "react";
import NextImage from "next/image";
import { Images, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";
import { PRODUCT_TILE_SIZES } from "@/components/shared/product-card";
import { LoadMore } from "@/components/shared/load-more";
import { useMediaLibraryPages } from "@/hooks/product/useMediaLibraryPages";
import type { MediaAssetDto } from "@server/catalog/media-library.types";

interface MediaLibraryPickerProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Refs already in the gallery, shown but not offered twice. */
  taken: ReadonlySet<string>;
  onPick: (asset: MediaAssetDto) => void;
}

type Kind = MediaAssetDto["kind"];

/**
 * Reuse from the library (media-library spec R6): the org's ready photos and videos as the 3-up
 * grid, paged as you scroll, fetched when the sheet opens — a tap, so a route handler is the
 * right seam. Picking adds the asset's ref to the gallery; the link to the asset row is made by
 * URL on save (trd D1).
 */
export function MediaLibraryPicker({ orgId, open, onOpenChange, taken, onPick }: MediaLibraryPickerProps) {
  const [kind, setKind] = useState<Kind>("IMAGE");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="adaptive">
        <SheetTitle>From your library</SheetTitle>
        <SheetDescription>Tap a photo or video to add it to this gallery.</SheetDescription>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={kind === "IMAGE" ? "default" : "outline"} onClick={() => setKind("IMAGE")}>
            <Images className="mr-1 size-4" /> Photos
          </Button>
          <Button type="button" size="sm" variant={kind === "VIDEO_EMBED" ? "default" : "outline"} onClick={() => setKind("VIDEO_EMBED")}>
            <Youtube className="mr-1 size-4" /> Videos
          </Button>
        </div>
        {/* Mounted only while open, so nothing is fetched for a picker nobody has tapped. */}
        {open && <PickerPages key={kind} orgId={orgId} kind={kind} taken={taken} onPick={onPick} />}
      </SheetContent>
    </Sheet>
  );
}

function PickerPages({
  orgId,
  kind,
  taken,
  onPick,
}: {
  orgId: string;
  kind: Kind;
  taken: ReadonlySet<string>;
  onPick: (asset: MediaAssetDto) => void;
}) {
  const { assets, loading, done, error, loadMore } = useMediaLibraryPages({ orgId, query: `kind=${kind}` });

  if (assets.length === 0 && done) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {kind === "IMAGE" ? "No photos in your library yet." : "No videos in your library yet."}
      </p>
    );
  }

  return (
    <>
      <ul className={PRODUCT_GRID_CLASSES}>
        {assets.map((asset) => {
          const isTaken = taken.has(asset.ref);
          return (
            <li key={asset.id}>
              <Button
                type="button"
                variant="ghost"
                disabled={isTaken}
                onClick={() => onPick(asset)}
                className="relative aspect-square h-auto w-full overflow-hidden rounded-card bg-muted p-0 disabled:opacity-40"
                aria-label={isTaken ? "Already in this gallery" : asset.kind === "VIDEO_EMBED" ? "Add this video" : "Add this photo"}
              >
                {asset.kind === "VIDEO_EMBED" ? (
                  <span className="flex size-full items-center justify-center">
                    <Youtube className="size-6 text-muted-foreground" aria-hidden />
                  </span>
                ) : (
                  <NextImage src={asset.ref} alt="" fill sizes={PRODUCT_TILE_SIZES} className="object-cover" />
                )}
              </Button>
            </li>
          );
        })}
      </ul>
      <LoadMore onMore={() => void loadMore()} done={done} loading={loading} error={error} count={assets.length} noun={kind === "IMAGE" ? "photos" : "videos"} />
    </>
  );
}
