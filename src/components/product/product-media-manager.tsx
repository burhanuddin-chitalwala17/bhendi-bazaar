/**
 * The product gallery editor: the category's named slots as a list, each filled by a
 * photograph, then the extras — more photographs and any video — in an order the org sets,
 * with one photograph designated the cover (media-library R4, D4).
 *
 * Photographs go browser-to-store against a presigned PUT, never through a function
 * (ADR-0028): a function request body is capped at 4.5MB, which one phone photograph
 * clears on its own and a multi-file selection clears easily — that cap was returning
 * FUNCTION_PAYLOAD_TOO_LARGE before any of our code ran. Downscaling therefore happens in
 * the browser (`uploadBatch`), since the server's sharp normalisation never sees these bytes
 * (ADR-0026). Every uploaded photograph is also judged on a small canvas — dark, blurred,
 * small — and the verdict is a banner, never a refusal (spec R8, trd D6).
 *
 * A picked photo is framed before it is spent (spec R8a, trd D6a): the crop sheet offers a turn
 * and a rectangle, or the photo as it is. A crop is two uploads — the untouched source, then the
 * crop registered as derived from it — and the crop's URL is what the row carries. Library
 * picks and videos never pass through the sheet.
 *
 * A video is uploaded as picked (video-hosting trd D2): nothing here downscales, crops or judges
 * it, because the worker transcodes it into what a buyer gets. Whether that is done is not known
 * here; the saved gallery tells the row its state, and a fresh upload is processing until then.
 * A YouTube link stays a link ([ADR-0017](../../docs/adr/0017-video-is-embedded-not-hosted.md)).
 * Why the cover is chosen rather than derived, and why nothing here pre-selects one:
 * docs/specs/product-video/trd.md D17/D17a.
 *
 * Mobile-first (ADR-0015): one row per item at base, every control a visible button
 * rather than a hover reveal, and reordering by move-up/move-down because drag-and-drop
 * alone is not an answer on a phone.
 */

"use client";

import { useEffect, useId, useRef, useState } from "react";
import NextImage from "next/image";
import { Film, Images, Loader2, Upload, Youtube } from "lucide-react";
import { useLocalPreviews } from "@/hooks/core/useLocalPreviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_MEDIA_PER_PRODUCT,
  parseYoutubeRef,
  youtubePosterUrl,
  type ProductMediaDto,
  type ProductMediaInput,
  type ProductMediaState,
} from "@server/catalog/media";
import { buildImagePath } from "@server/catalog/image-paths";
import { isVideoContentType } from "@server/catalog/video";
import { uploadBatch } from "@/lib/image/upload-batch";
import { uploadVideo } from "@/lib/image/upload-video";
import { downscaleImage } from "@/lib/image/downscale";
import { renderCrop } from "@/lib/image/render-crop";
import type { CropTransform } from "@/lib/image/crop-transform";
import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { SHOT_ROLE, unknownSlots, type ShotList, type ShotRole } from "@server/catalog/shot-list";
import { judgeCapture, warningsForRole, type CaptureWarning } from "@server/catalog/capture-checks";
import { analyseCapture } from "@/lib/image/capture-checks";
import { MediaLibraryPicker } from "@/components/product/media-library-picker";
import type { MediaAssetDto } from "@server/catalog/media-library.types";
import {
  assignSlotTo,
  clearSlot,
  moveExtra,
  orderGallery,
  splitGallery,
} from "@/components/product/gallery-order";
import { ExtraRow, SlotRow } from "@/components/product/gallery-rows";
import { CropDialog } from "@/components/product/crop-dialog";
import { ImproveDialog, type ImproveTarget } from "@/components/product/improve-dialog";
import type { AvailableTool, EnhancementDto } from "@server/content/enhancement.types";

interface ProductMediaManagerProps {
  value: ProductMediaInput[];
  onChange: (media: ProductMediaInput[]) => void;
  /** The register-and-sign and confirm routes — the caller knows whose guard applies. Bytes never reach them. */
  endpoints: UploadEndpoints;
  /**
   * The owning org's code. It is the folder the presign route will sign a path under,
   * so without it there is nothing to ask permission for.
   */
  orgCode?: string;
  /** The product's name — names the stored path instead of the `unnamed-` fallback. */
  identifier?: string;
  /** The named slots this product's category asks for, already resolved up the tree (media-library D4). */
  shotList: ShotList;
  /** The owning org's id, which is what the library picker is scoped by. Without it there is no library to pick from. */
  orgId?: string;
  /**
   * The gallery as last saved, for what the editor cannot know on its own: a hosted video's
   * poster and whether the worker is done with it (video-hosting spec R3, R7). A row not in
   * here was uploaded in this session and is processing.
   */
  savedMedia?: ReadonlyArray<Pick<ProductMediaDto, "ref" | "poster" | "state">>;
}

/** What a hosted video's row shows about its readiness. */
interface VideoStatus {
  poster: string | null;
  state: ProductMediaState;
}

/** A photo waiting in the crop sheet: what was picked, what will be stored, and where it goes. */
interface QueuedPhoto {
  id: string;
  picked: File;
  /** Reduced already, so the crop rectangle is measured on the picture that becomes the source (trd D6a). */
  ready: File;
  /**
   * What the frame shows. Made here, where the photo joins the queue, and released where it
   * leaves — an object URL made during a render and released by an effect's cleanup does not
   * survive a development remount, and the frame then has nothing to show.
   */
  previewUrl: string;
  slot: string | null;
}

/** Everything a queued photo holds that the browser will not collect on its own. */
function releasePreviews(photos: readonly QueuedPhoto[]): void {
  photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
}

const CAPACITY_NOTICE = `A product can have at most ${MAX_MEDIA_PER_PRODUCT} gallery items`;

export function ProductMediaManager({
  value,
  onChange,
  endpoints,
  orgCode,
  identifier,
  shotList,
  orgId,
  savedMedia = [],
}: ProductMediaManagerProps) {
  const media = value ?? [];
  const [isUploading, setIsUploading] = useState(false);
  /** The slot whose button shows the spinner; null while the extras upload runs. */
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [linkDraft, setLinkDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  /** The slot a library pick lands in; null when the picker was opened from the extras. */
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);
  /** Photos picked and not yet decided on; the sheet shows the first (spec R8a). */
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const queuedIds = useRef(0);
  /** The photo the improve sheet is open on (image-enhancement spec R2); null when it is closed. */
  const [improving, setImproving] = useState<ImproveTarget | null>(null);
  /** The tool the sheet starts on, when a capture warning already named it (spec R6); else null. */
  const [preselect, setPreselect] = useState<AvailableTool | null>(null);
  // Every uploaded photograph's full judgement, keyed by ref; narrowed to its slot's role at
  // render, so a photo moved from a lifestyle slot to a product one shows what it now owes
  // without a second look at the pixels. A dismissal is also by ref, and is for good.
  const [judgements, setJudgements] = useState<Record<string, CaptureWarning[]>>({});
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extrasHeadingId = useId();
  const { remember, localPreview } = useLocalPreviews();

  const atCapacity = media.length >= MAX_MEDIA_PER_PRODUCT;
  const photographCount = media.filter((item) => item.kind === "IMAGE").length;
  const { filled, extras } = splitGallery(media, shotList);
  const current = queue[0] ?? null;

  const videoStatus = (item: ProductMediaInput): VideoStatus | null => {
    if (item.kind !== "VIDEO") return null;
    const saved = savedMedia.find((row) => row.ref === item.ref);
    return { poster: saved?.poster ?? null, state: saved?.state ?? "processing" };
  };

  const roleOf = (slot: string | null | undefined): ShotRole | null =>
    shotList.find((candidate) => candidate.key === slot)?.role ?? null;
  const warningsFor = (item: ProductMediaInput): CaptureWarning[] =>
    kept.has(item.ref) ? [] : warningsForRole(judgements[item.ref] ?? [], roleOf(item.slot));

  // The array is what `position` is written from, so it is kept in the order the editor shows:
  // filled slots in shot-list order, then the extras as arranged (D4).
  const commit = (next: ProductMediaInput[]) => onChange(orderGallery(next, shotList));

  // A slot key is only meaningful against the category's list, and the server refuses one
  // it does not declare (D4). Changing category therefore turns those photographs back into
  // extras here, where the org member can see it, rather than at submit.
  const slotKeys = shotList.map((slot) => slot.key).join(",");
  useEffect(() => {
    const stale = unknownSlots(media.map((item) => item.slot), shotList);
    if (stale.length === 0) return;
    commit(
      media.map((item) =>
        item.slot && stale.includes(item.slot) ? { ...item, slot: null } : item,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the list changes, not on every edit
  }, [slotKeys]);

  // Checks run on the picked file, not the stored copy, and after the photo is already in the
  // gallery: the verdict arrives as a banner when it is ready and holds nothing up (spec R8).
  const judge = async (files: File[], urls: string[]) => {
    await Promise.all(
      files.map(async (file, index) => {
        const frame = await analyseCapture(file);
        if (!frame) return;
        const verdict = judgeCapture({ ...frame, role: null });
        setJudgements((current) => ({ ...current, [urls[index]]: verdict }));
      }),
    );
  };

  const pathFor = (file: File) => buildImagePath("products", file.name, identifier, orgCode);

  const canAdd = (count: number): boolean => {
    if (media.length + count > MAX_MEDIA_PER_PRODUCT) {
      setNotice(CAPACITY_NOTICE);
      return false;
    }
    if (!orgCode) {
      setNotice("Choose the selling organisation before uploading photographs");
      return false;
    }
    return true;
  };

  /**
   * Stored URLs into the gallery. `previews` are the pictures the rows show and `judged` the
   * ones the checks read, both index-aligned with `urls`: for a plain upload both are the file
   * picked, for a crop the row shows the crop while the checks still read the original (D6).
   */
  const place = (urls: string[], previews: File[], judged: File[], targetSlot: string | null) => {
    remember(previews, urls);
    // A repeat upload is answered with the org's existing image (D11), which may already sit
    // in this gallery; one item per ref keeps the slot and warning bookkeeping honest.
    const fresh = urls.filter(
      (url, index) => urls.indexOf(url) === index && !media.some((item) => item.ref === url),
    );
    // Deliberately does not designate a cover, even for the very first upload: a
    // default that stands in for a missing choice is what makes its absence
    // invisible (D17a). The org taps "Cover".
    let next: ProductMediaInput[] = [
      ...media,
      ...fresh.map((url) => ({ kind: "IMAGE" as const, ref: url, isThumbnail: false, slot: null })),
    ];
    if (targetSlot && fresh[0]) next = assignSlotTo(next, fresh[0], targetSlot);
    commit(next);
    void judge(judged, urls);
  };

  const upload = async (files: File[], targetSlot: string | null, judged: File[] = files) => {
    if (files.length === 0 || !canAdd(files.length)) return;

    setIsUploading(true);
    setUploadingSlot(targetSlot);
    setNotice(null);
    setProgress({ done: 0, total: files.length });
    try {
      const { urls: uploadedUrls, failed, firstError, reused } = await uploadBatch(files, {
        endpoints,
        pathFor,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      // Index-aligned with the originals, which is what useLocalPreviews pairs on — and
      // the original is the right preview: it is the picture the org member picked.
      const landed: File[] = [];
      const urls: string[] = [];
      uploadedUrls.forEach((url, index) => {
        if (!url) return;
        landed.push(judged[index]);
        urls.push(url);
      });
      place(urls, landed, landed, targetSlot);

      if (failed.length > 0) {
        setNotice(
          `Could not upload ${failed.join(", ")} (${firstError}).` +
            (urls.length > 0 ? " The rest were added." : ""),
        );
      } else if (reused > 0) {
        // Not an error: the org already had these bytes, so they were added from the library.
        setNotice(
          reused === 1
            ? "One photo was already in your library and was added from there."
            : `${reused} photos were already in your library and were added from there.`,
        );
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setIsUploading(false);
      setUploadingSlot(null);
      setProgress({ done: 0, total: 0 });
    }
  };

  /**
   * A crop is two objects (trd D6a): the untouched picture goes first and becomes the source;
   * the crop follows, registered as derived from it, and is what fills the row. A later surface
   * that needs pixels the crop discarded reaches back to the source; re-cropping costs nothing.
   */
  const uploadCropped = async ({ picked, ready, slot }: QueuedPhoto, transform: CropTransform) => {
    if (!canAdd(1)) return;

    setIsUploading(true);
    setUploadingSlot(slot);
    setNotice(null);
    setProgress({ done: 0, total: 2 });
    try {
      const source = await uploadBatch([ready], { endpoints, pathFor });
      const sourceUrl = source.urls[0];
      if (!sourceUrl) throw new Error(source.firstError ?? "Upload failed");
      setProgress({ done: 1, total: 2 });

      const cropFile = await renderCrop(ready, transform);
      const sourceAssetId = source.assetIds[0];
      const derived = await uploadBatch([cropFile], {
        endpoints,
        pathFor,
        derivedFrom: sourceAssetId ? { assetId: sourceAssetId, transform } : undefined,
      });
      const cropUrl = derived.urls[0];
      if (!cropUrl) throw new Error(derived.firstError ?? "Upload failed");

      place([cropUrl], [cropFile], [picked], slot);
      if (derived.reused) setNotice("That crop was already in your library and was added from there.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setIsUploading(false);
      setUploadingSlot(null);
      setProgress({ done: 0, total: 0 });
    }
  };

  /**
   * Videos go up as picked, one after another (video-hosting trd D2): no sheet, no downscale, no
   * judgement — the worker makes the playable sizes. Each row is added the moment its upload
   * lands, marked processing, and the product can be saved meanwhile (spec R3).
   */
  const uploadVideos = async (files: File[]) => {
    if (files.length === 0 || !canAdd(files.length)) return;
    setIsUploading(true);
    setUploadingSlot(null);
    setNotice(null);
    setProgress({ done: 0, total: files.length });
    const landed: string[] = [];
    const failed: string[] = [];
    let firstError: string | null = null;
    try {
      for (const [index, file] of files.entries()) {
        try {
          const result = await uploadVideo(file, { endpoints, pathFor });
          landed.push(result.url);
        } catch (error) {
          failed.push(file.name);
          firstError ??= error instanceof Error ? error.message : "Upload failed";
        }
        setProgress({ done: index + 1, total: files.length });
      }
      const fresh = landed.filter((url, index) => landed.indexOf(url) === index && !media.some((item) => item.ref === url));
      if (fresh.length > 0) {
        commit([...media, ...fresh.map((url) => ({ kind: "VIDEO" as const, ref: url, isThumbnail: false, slot: null }))]);
      }
      if (failed.length > 0) {
        setNotice(`Could not upload ${failed.join(", ")} (${firstError}).` + (fresh.length > 0 ? " The rest were added." : ""));
      }
    } finally {
      setIsUploading(false);
      setProgress({ done: 0, total: 0 });
    }
  };

  /**
   * A pick opens the crop sheet rather than uploading (spec R8a). Each photo is reduced first,
   * one at a time, so the rectangle is measured on the picture that will be stored as the source.
   */
  const queueForCrop = async (files: File[], targetSlot: string | null) => {
    if (files.length === 0 || !canAdd(files.length)) return;
    setNotice(null);
    const queued: QueuedPhoto[] = [];
    for (const picked of files) {
      queuedIds.current += 1;
      const ready = await downscaleImage(picked);
      queued.push({
        id: String(queuedIds.current),
        picked,
        ready,
        previewUrl: URL.createObjectURL(ready),
        slot: targetSlot,
      });
    }
    setQueue((current) => [...current, ...queued]);
  };

  const dequeue = (ids: string[]) =>
    setQueue((current) => {
      const [leaving, staying] = [
        current.filter((item) => ids.includes(item.id)),
        current.filter((item) => !ids.includes(item.id)),
      ];
      releasePreviews(leaving);
      return staying;
    });

  const acceptAsIs = async () => {
    if (!current) return;
    await upload([current.ready], current.slot, [current.picked]);
    dequeue([current.id]);
  };

  const acceptCrop = async (transform: CropTransform) => {
    if (!current) return;
    await uploadCropped(current, transform);
    dequeue([current.id]);
  };

  // Only ever offered from a multi-file pick, which the extras input alone allows: every queued
  // photo is an extra.
  const acceptAllAsIs = async () => {
    const rest = queue;
    if (rest.length === 0) return;
    await upload(rest.map((item) => item.ready), null, rest.map((item) => item.picked));
    dequeue(rest.map((item) => item.id));
  };

  const handleExtrasFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    // Cleared at once so picking the same file again still fires a change.
    event.target.value = "";
    // One input, two paths (video-hosting R1): a video is sent as it is, a photo is framed first.
    const videos = files.filter((file) => isVideoContentType(file.type));
    const photos = files.filter((file) => !isVideoContentType(file.type));
    if (photos.length > 0) void queueForCrop(photos, null);
    if (videos.length > 0) void uploadVideos(videos);
  };

  const addVideo = () => {
    if (atCapacity) {
      setNotice(CAPACITY_NOTICE);
      return;
    }
    const ref = parseYoutubeRef(linkDraft);
    if (!ref) {
      setNotice("That does not look like a YouTube link");
      return;
    }
    if (media.some((item) => item.kind === "YOUTUBE" && item.ref === ref)) {
      setNotice("That video is already in this gallery");
      return;
    }
    setNotice(null);
    setLinkDraft("");
    commit([...media, { kind: "YOUTUBE", ref, isThumbnail: false, slot: null }]);
  };

  const openPicker = (slot: string | null) => {
    setPickerSlot(slot);
    setIsPickerOpen(true);
  };

  const setPickerOpen = (open: boolean) => {
    setIsPickerOpen(open);
    if (!open) setPickerSlot(null);
  };

  // A library pick is a reference to bytes that already exist: nothing uploads, nothing is
  // re-checked — they were judged when first uploaded — and the row is linked to its asset by
  // URL on save (media-library trd D1).
  const pickFromLibrary = (asset: MediaAssetDto) => {
    if (atCapacity) {
      setNotice(CAPACITY_NOTICE);
      return;
    }
    if (media.some((item) => item.ref === asset.ref)) return;
    setNotice(null);
    const picked: ProductMediaInput = {
      kind: asset.kind === "VIDEO_EMBED" ? "YOUTUBE" : asset.kind === "VIDEO" ? "VIDEO" : "IMAGE",
      ref: asset.ref,
      isThumbnail: false,
      slot: null,
    };
    let next: ProductMediaInput[] = [...media, picked];
    if (pickerSlot && picked.kind === "IMAGE") {
      next = assignSlotTo(next, picked.ref, pickerSlot);
      // A slot holds one photograph, so the pick is the end of the errand.
      setPickerOpen(false);
    } else if (pickerSlot) {
      setNotice("A video is always an extra, so it was added below the slots");
    }
    commit(next);
  };

  const unpickFromLibrary = (asset: MediaAssetDto) => remove(asset.ref);

  const remove = (ref: string) => {
    // R15/A12: the cover cannot simply be dropped. Refusing here, where the org member is
    // looking, beats letting the payload fail validation on submit.
    if (media.some((item) => item.ref === ref && item.isThumbnail)) {
      setNotice("Choose another cover before removing this photograph");
      return;
    }
    setNotice(null);
    commit(media.filter((item) => item.ref !== ref));
  };

  const move = (ref: string, delta: 1 | -1) => {
    setNotice(null);
    // Reordering moves nothing but position: the cover flag travels with its item, so
    // the card is untouched by a gallery rearrangement (R16).
    onChange(moveExtra(media, ref, delta, shotList));
  };

  const setCover = (ref: string) => {
    setNotice(null);
    commit(media.map((item) => ({ ...item, isThumbnail: item.ref === ref })));
  };

  const assignSlot = (ref: string, slot: string) => {
    setNotice(null);
    commit(assignSlotTo(media, ref, slot));
  };

  const moveToExtra = (ref: string) => {
    setNotice(null);
    commit(clearSlot(media, ref));
  };

  const describe = (ref: string, description: string) => {
    commit(media.map((item) => (item.ref === ref ? { ...item, description } : item)));
  };

  const keep = (ref: string) => setKept((current) => new Set(current).add(ref));

  /** Open the sheet on a photo, on the tool a capture warning named where it named one (spec R6). */
  const openImprove = (target: ImproveTarget, tool?: AvailableTool) => {
    setImproving(target);
    setPreselect(tool ?? null);
  };

  const closeImprove = () => {
    setImproving(null);
    setPreselect(null);
  };

  /**
   * An accepted improvement takes its row over — same slot, same cover, same description — so the
   * slot shows the improved photo and the library holds both, the new pointing at the old (spec A1).
   * The old ref's capture verdict does not follow: the new photo is judged as itself, if at all.
   */
  const replaceRef = (sourceRef: string, result: EnhancementDto) => {
    closeImprove();
    if (!result.resultRef) return;
    commit(media.map((item) => (item.ref === sourceRef ? { ...item, ref: result.resultRef ?? item.ref } : item)));
  };

  return (
    <div className="space-y-6">
      <ul className="space-y-3" aria-label="Photo slots">
        {shotList.map((slot) => {
          const item = filled.get(slot.key) ?? null;
          return (
            <SlotRow
              key={slot.key}
              slot={slot}
              item={item}
              thumb={item ? <MediaThumb item={item} preview={localPreview(item.ref)} /> : null}
              warnings={item ? warningsFor(item) : []}
              uploading={isUploading && uploadingSlot === slot.key}
              disabled={isUploading || atCapacity}
              canPickFromLibrary={!!orgId}
              onFiles={(files) => void queueForCrop(files, slot.key)}
              onPickFromLibrary={() => openPicker(slot.key)}
              onDescribe={(description) => item && describe(item.ref, description)}
              onCover={() => item && setCover(item.ref)}
              onMoveToExtra={() => item && moveToExtra(item.ref)}
              onRemove={() => item && remove(item.ref)}
              onKeepAnyway={() => item && keep(item.ref)}
              onImprove={
                item && orgId && slot.role !== SHOT_ROLE.LABEL
                  ? (tool) => openImprove({ ref: item.ref, slot: slot.key, slotRole: slot.role }, tool)
                  : undefined
              }
            />
          );
        })}
      </ul>

      <section className="space-y-3" aria-labelledby={extrasHeadingId}>
        <div>
          <h3 id={extrasHeadingId} className="text-sm font-medium text-foreground">
            Extras
          </h3>
          <p className="text-xs text-muted-foreground">
            More photos and any video, shown after the slots in this order.
          </p>
        </div>

        {extras.length > 0 && (
          <ul className="space-y-3">
            {extras.map((item, index) => (
              <ExtraRow
                key={`${item.kind}-${item.ref}`}
                item={item}
                index={index}
                count={extras.length}
                thumb={<MediaThumb item={item} preview={localPreview(item.ref)} poster={videoStatus(item)?.poster ?? null} />}
                status={videoStatus(item)?.state ?? null}
                shotList={shotList}
                warnings={warningsFor(item)}
                onDescribe={(description) => describe(item.ref, description)}
                onCover={() => setCover(item.ref)}
                onMove={(delta) => move(item.ref, delta)}
                onAssignSlot={(slot) => assignSlot(item.ref, slot)}
                onRemove={() => remove(item.ref)}
                onKeepAnyway={() => keep(item.ref)}
                onImprove={
                  orgId && item.kind === "IMAGE"
                    ? (tool) => openImprove({ ref: item.ref, slot: null, slotRole: null }, tool)
                    : undefined
                }
              />
            ))}
          </ul>
        )}

        {notice && (
          <p role="alert" className="text-sm text-destructive">
            {notice}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || atCapacity}
            className="sm:w-auto"
          >
            {isUploading && uploadingSlot === null ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Upload />
            )}
            {isUploading && uploadingSlot === null
              ? progress.total > 1
                ? `Uploading ${progress.done}/${progress.total}…`
                : "Uploading…"
              : "Upload photos or a video"}
          </Button>
          {orgId && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => openPicker(null)}
              disabled={isUploading || atCapacity}
              className="sm:w-auto"
            >
              <Images /> From library
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            placeholder="Paste a YouTube link"
            aria-label="YouTube link"
            disabled={atCapacity}
            className="h-10"
          />
          <Button type="button" variant="outline" size="lg" onClick={addVideo} disabled={atCapacity}>
            <Youtube /> Add video
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleExtrasFileSelect}
          className="hidden"
        />
      </section>

      {orgId && (
        <MediaLibraryPicker
          orgId={orgId}
          open={isPickerOpen}
          onOpenChange={setPickerOpen}
          taken={new Set(media.map((item) => item.ref))}
          onPick={pickFromLibrary}
          onUnpick={unpickFromLibrary}
        />
      )}

      {orgId && (
        <ImproveDialog
          orgId={orgId}
          target={improving}
          preselect={preselect}
          onAccepted={replaceRef}
          onClose={closeImprove}
        />
      )}

      <CropDialog
        photo={current ? { id: current.id, src: current.previewUrl } : null}
        remaining={Math.max(0, queue.length - 1)}
        busy={isUploading}
        onUseAsIs={() => void acceptAsIs()}
        onUseCrop={(transform) => void acceptCrop(transform)}
        onUseAllAsIs={() => void acceptAllAsIs()}
        onCancel={() =>
          setQueue((pending) => {
            releasePreviews(pending);
            return [];
          })
        }
      />

      <p className="text-xs text-muted-foreground">
        {photographCount === 0
          ? "At least one photograph is required. Video is optional."
          : `${media.length} of ${MAX_MEDIA_PER_PRODUCT} items · ${filled.size} of ${shotList.length} slots filled. Tap "Cover" on the photograph that should represent this product in listings.`}{" "}
        Photos are resized in your browser before upload, so large files are fine. A video is sent as it is and made
        playable in the background.
      </p>
    </div>
  );
}

/**
 * The 64px thumbnail: a just-uploaded photo from the file still in the page, else the stored copy.
 * A hosted video shows its poster once the worker has made one, and a film mark until then.
 */
function MediaThumb({ item, preview, poster = null }: { item: ProductMediaInput; preview: string | null; poster?: string | null }) {
  if (item.kind === "VIDEO") {
    return (
      <div className="relative size-16 shrink-0 overflow-hidden rounded-field bg-muted">
        {poster && <NextImage src={poster} alt="" fill sizes="64px" className="object-cover" />}
        <span className="absolute inset-0 flex items-center justify-center bg-scrim/40">
          <Film className="size-5 text-hero-foreground" aria-hidden />
        </span>
      </div>
    );
  }
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-field bg-muted">
      {/* Contained, not covered: this thumbnail is the org member's proof of what was stored, and a
          square box that centre-crops a tall photo is how "use as is" came to look like a crop. */}
      {item.kind === "IMAGE" && preview ? (
        /* Just uploaded, so the file is still in the page — fetching the stored copy back
           would be egress for nothing (ADR-0026). */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="size-full object-contain" />
      ) : (
        <NextImage
          src={item.kind === "YOUTUBE" ? youtubePosterUrl(item.ref) : item.ref}
          alt=""
          fill
          sizes="64px"
          unoptimized={item.kind === "YOUTUBE"}
          className={item.kind === "YOUTUBE" ? "object-cover" : "object-contain"}
        />
      )}
      {item.kind === "YOUTUBE" && (
        <span className="absolute inset-0 flex items-center justify-center bg-scrim/40">
          <Youtube className="size-5 text-hero-foreground" aria-hidden />
        </span>
      )}
    </div>
  );
}
