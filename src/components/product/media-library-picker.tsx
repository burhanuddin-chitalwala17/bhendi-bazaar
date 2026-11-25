import { useCallback, useEffect, useId, useState } from "react";
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
import { usePickerFilters } from "@/hooks/product/usePickerFilters";
import { MediaFilterFields, type MediaFilterField } from "@/components/org/media-filter-fields";
import { MEDIA_SOURCE_OPTIONS } from "@/components/org/media-library-copy";
import { StateActionButton } from "@/components/shared/states/state-action";
import { activePickerFilterCount, hasPickerFilters, pickerQuery, sourcesFor, tagAppliesTo } from "@/lib/media/picker-query";
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
  IMAGE: { label: LIBRARY_PICKER_COPY.tabPhotos, icon: "photos" },
  VIDEO: { label: LIBRARY_PICKER_COPY.tabVideos, icon: "video" },
  VIDEO_EMBED: { label: LIBRARY_PICKER_COPY.tabYouTube, icon: "youtube" },
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
  description = LIBRARY_PICKER_COPY.description,
}: MediaLibraryPickerProps) {
  const [kind, setKind] = useState<Kind>(kinds[0] ?? "IMAGE");
  const { filters, setFilters, clear } = usePickerFilters();
  const [panelOpen, setPanelOpen] = useState(false);
  // Tabs whose library is empty unfiltered: nothing to filter, so no Filters button (ux Empty (library)).
  const [emptyKinds, setEmptyKinds] = useState<ReadonlySet<Kind>>(new Set());
  const onLibraryEmpty = useCallback(
    (empty: boolean) =>
      setEmptyKinds((current) => {
        if (current.has(kind) === empty) return current;
        const next = new Set(current);
        if (empty) next.add(kind);
        else next.delete(kind);
        return next;
      }),
    [kind],
  );
  const panelId = useId();
  const canFilter = !emptyKinds.has(kind);
  const query = pickerQuery(kind, filters);
  const sources = MEDIA_SOURCE_OPTIONS.filter((option) => sourcesFor(kind).includes(option.value));
  // Only what can apply to this tab is offered (R2): a tag on a photo, a source with more than one answer.
  const omit: MediaFilterField[] = ["kind"];
  if (!tagAppliesTo(kind)) omit.push("tag");
  if (sources.length === 0) omit.push("source");
  return (
    <TaskDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width="gallery"
    >
      <div className="flex shrink-0 flex-wrap items-end gap-2">
        {/* One tab is no choice, so the tabs are left out rather than shown pressed. */}
        {kinds.length > 1 &&
          kinds.map((tab) => {
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
        {/* Four selects would push the grid below a phone's fold, so they wait behind one button there (Q5). */}
        {canFilter && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto md:hidden"
              aria-expanded={panelOpen}
              aria-controls={panelId}
              onClick={() => setPanelOpen((current) => !current)}
            >
              {LIBRARY_PICKER_COPY.filtersButton(activePickerFilterCount(kind, filters))}
            </Button>
            <div
              id={panelId}
              className={cn("basis-full flex-col gap-2 md:flex md:basis-auto md:flex-row md:flex-wrap md:items-end", panelOpen ? "flex" : "hidden")}
            >
              <MediaFilterFields
                value={filters}
                onChange={setFilters}
                kinds={[]}
                sources={sources}
                omit={omit}
                fieldClassName="text-sm md:w-36"
                whenClassName="text-sm md:w-56"
              />
            </div>
          </>
        )}
      </div>
      {/* Mounted only while open, so nothing is fetched for a picker nobody has tapped. Keyed on the
          query, so a filter change starts the grid over; the ticks come from `taken` and survive (D4). */}
      {open && (
        <PickerPages
          key={query}
          orgId={orgId}
          kind={kind}
          query={query}
          filtered={hasPickerFilters(kind, filters)}
          onClear={clear}
          onLibraryEmpty={onLibraryEmpty}
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
  query,
  filtered,
  onClear,
  onLibraryEmpty,
  taken,
  onPick,
  onUnpick,
}: {
  orgId: string;
  kind: Kind;
  query: string;
  filtered: boolean;
  onClear: () => void;
  onLibraryEmpty: (empty: boolean) => void;
  taken: ReadonlySet<string>;
  onPick: (asset: MediaAssetDto) => void;
  onUnpick: (asset: MediaAssetDto) => void;
}) {
  const { assets, loading, done, error, loadMore } = useMediaLibraryPages({ orgId, query });

  // Only an unfiltered answer says whether the library itself is empty.
  useEffect(() => {
    if (done && !filtered) onLibraryEmpty(assets.length === 0);
  }, [done, filtered, assets.length, onLibraryEmpty]);

  if (assets.length === 0 && done && filtered) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
        <Icon name="search" size="lg" />
        <p>{LIBRARY_PICKER_COPY.nothingMatches}</p>
        <StateActionButton action={{ label: LIBRARY_PICKER_COPY.clearFilters, onClick: onClear }} />
      </div>
    );
  }

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
                        {asset.state === "FAILED" ? LIBRARY_PICKER_COPY.failed : LIBRARY_PICKER_COPY.processing}
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
          kind === "IMAGE"
            ? LIBRARY_PICKER_COPY.nounPhotos
            : kind === "VIDEO"
              ? LIBRARY_PICKER_COPY.nounVideos
              : LIBRARY_PICKER_COPY.nounLinks
        }
      />
    </>
  );
}
