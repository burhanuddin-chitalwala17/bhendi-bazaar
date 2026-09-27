/**
 * The product gallery editor: photographs uploaded to the object store, videos
 * referenced by link, in an order the org sets, with one photograph designated the cover.
 *
 * Photographs go browser-to-store against a presigned PUT, never through a function
 * (ADR-0028): a function request body is capped at 4.5MB, which one phone photograph
 * clears on its own and a multi-file selection clears easily — that cap was returning
 * FUNCTION_PAYLOAD_TOO_LARGE before any of our code ran. Downscaling therefore happens
 * here, since the server's sharp normalisation never sees these bytes (ADR-0026).
 *
 * Why video is a link and not an upload: [ADR-0017](../../docs/adr/0017-video-is-embedded-not-hosted.md).
 * Why the cover is chosen rather than derived, and why nothing here pre-selects one:
 * docs/specs/product-video/trd.md D17/D17a.
 *
 * Mobile-first (ADR-0015): one row per item at base, every control a visible button
 * rather than a hover reveal, and reordering by move-up/move-down because drag-and-drop
 * alone is not an answer on a phone.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Star,
  Upload,
  X,
  Youtube,
} from "lucide-react";
import { useLocalPreviews } from "@/hooks/core/useLocalPreviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  MAX_MEDIA_PER_PRODUCT,
  parseYoutubeRef,
  youtubePosterUrl,
  type ProductMediaInput,
} from "@server/catalog/media";
import { buildImagePath, imageFileProblem } from "@server/catalog/image-paths";
import { downscaleImage } from "@/lib/image/downscale";
import { uploadDirect } from "@/lib/image/upload-direct";
import type { UploadEndpoints } from "@/lib/image/upload-endpoints";
import { unknownSlots, type ShotList } from "@server/catalog/shot-list";

/** Bounded, not a stampede: a phone's radio and the presign route both prefer it. */
const UPLOAD_CONCURRENCY = 3;

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
}

export function ProductMediaManager({
  value,
  onChange,
  endpoints,
  orgCode,
  identifier,
  shotList,
}: ProductMediaManagerProps) {
  const media = value ?? [];
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [linkDraft, setLinkDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { remember, localPreview } = useLocalPreviews();

  const atCapacity = media.length >= MAX_MEDIA_PER_PRODUCT;
  const photographCount = media.filter((item) => item.kind === "IMAGE").length;
  const filledSlots = new Set(media.map((item) => item.slot).filter(Boolean));

  // A slot key is only meaningful against the category's list, and the server refuses one
  // it does not declare (D4). Changing category therefore turns those photographs back into
  // extras here, where the org member can see it, rather than at submit.
  const slotKeys = shotList.map((slot) => slot.key).join(",");
  useEffect(() => {
    const stale = unknownSlots(media.map((item) => item.slot), shotList);
    if (stale.length === 0) return;
    onChange(
      media.map((item) =>
        item.slot && stale.includes(item.slot) ? { ...item, slot: null } : item,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the list changes, not on every edit
  }, [slotKeys]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (media.length + files.length > MAX_MEDIA_PER_PRODUCT) {
      setNotice(
        `A product can have at most ${MAX_MEDIA_PER_PRODUCT} gallery items`,
      );
      return;
    }
    if (!orgCode) {
      setNotice("Choose the selling organisation before uploading photographs");
      return;
    }

    setIsUploading(true);
    setNotice(null);
    setProgress({ done: 0, total: files.length });
    try {
      // Downscale first, then check the size: the whole point is that what was picked
      // may be far larger than what we are willing to store. Type is checked on the
      // result too, since a file no decoder accepts comes back through unchanged.
      // The whole selection is validated before any of it is uploaded — a batch refused
      // outright is easier to explain than a half-done one.
      const prepared: File[] = [];
      for (const file of files) {
        const ready = await downscaleImage(file);
        const problem = imageFileProblem(ready);
        if (problem) throw new Error(problem);
        prepared.push(ready);
      }

      const uploadedUrls: (string | undefined)[] = new Array(prepared.length);
      const failed: string[] = [];
      let firstError: string | null = null;
      const queue = prepared.map((file, index) => ({ file, index }));
      let done = 0;
      const worker = async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          try {
            uploadedUrls[job.index] = await uploadDirect(
              buildImagePath("products", job.file.name, identifier, orgCode),
              job.file,
              endpoints,
            );
          } catch (error) {
            // A network failure part-way through cannot be undone without deleting what
            // already landed, so the successes are kept and the rest are named.
            failed.push(files[job.index].name);
            firstError ??=
              error instanceof Error ? error.message : "Upload failed";
          }
          done += 1;
          setProgress({ done, total: prepared.length });
        }
      };
      await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));

      // Index-aligned with the originals, which is what useLocalPreviews pairs on — and
      // the original is the right preview: it is the picture the org member picked.
      const localFiles: File[] = [];
      const urls: string[] = [];
      uploadedUrls.forEach((url, index) => {
        if (!url) return;
        localFiles.push(files[index]);
        urls.push(url);
      });
      remember(localFiles, urls);

      const uploaded: ProductMediaInput[] = urls.map((url) => ({
        kind: "IMAGE",
        ref: url,
        isThumbnail: false,
      }));
      // Deliberately does not designate a cover, even for the very first upload: a
      // default that stands in for a missing choice is what makes its absence
      // invisible (D17a). The org taps "Cover".
      onChange([...media, ...uploaded]);

      if (failed.length > 0) {
        setNotice(
          `Could not upload ${failed.join(", ")} (${firstError}).` +
            (urls.length > 0 ? " The rest were added." : ""),
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Failed to upload images",
      );
    } finally {
      setIsUploading(false);
      setProgress({ done: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addVideo = () => {
    if (atCapacity) {
      setNotice(
        `A product can have at most ${MAX_MEDIA_PER_PRODUCT} gallery items`,
      );
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
    onChange([...media, { kind: "YOUTUBE", ref, isThumbnail: false }]);
  };

  const remove = (index: number) => {
    // R15/A12: the cover cannot simply be dropped. Refusing here, where the org member is
    // looking, beats letting the payload fail validation on submit.
    if (media[index].isThumbnail) {
      setNotice("Choose another cover before removing this photograph");
      return;
    }
    setNotice(null);
    onChange(media.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= media.length) return;
    const next = [...media];
    [next[index], next[target]] = [next[target], next[index]];
    setNotice(null);
    // Reordering moves nothing but position: the cover flag travels with its item, so
    // the card is untouched by a gallery rearrangement (R16).
    onChange(next);
  };

  const setCover = (index: number) => {
    setNotice(null);
    onChange(media.map((item, i) => ({ ...item, isThumbnail: i === index })));
  };

  // One photograph per slot: assigning it here takes it from whichever item held it.
  const assignSlot = (index: number, slot: string) => {
    setNotice(null);
    onChange(
      media.map((item, i) => {
        if (i === index) return { ...item, slot: slot || null };
        return item.slot === slot ? { ...item, slot: null } : item;
      }),
    );
  };

  const describe = (index: number, description: string) => {
    onChange(
      media.map((item, i) => (i === index ? { ...item, description } : item)),
    );
  };

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="Photo slots">
        {shotList.map((slot) => (
          <li key={slot.key}>
            <Badge
              variant={filledSlots.has(slot.key) ? "default" : "outline"}
              title={slot.hint}
            >
              {slot.label}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        {media.map((item, index) => (
          <div
            key={`${item.kind}-${item.ref}-${index}`}
            className="flex gap-3 rounded-lg border border-border p-3"
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.kind === "IMAGE" && localPreview(item.ref) ? (
                /* Just uploaded, so the file is still in the page — fetching the Blob
                   copy back would be egress for nothing (ADR-0026). */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localPreview(item.ref)!}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <NextImage
                  src={
                    item.kind === "YOUTUBE"
                      ? youtubePosterUrl(item.ref)
                      : item.ref
                  }
                  alt=""
                  fill
                  sizes="64px"
                  unoptimized={item.kind === "YOUTUBE"}
                  className="object-cover"
                />
              )}
              {item.kind === "YOUTUBE" && (
                <span className="absolute inset-0 flex items-center justify-center bg-scrim/40">
                  <Youtube
                    className="size-5 text-hero-foreground"
                    aria-hidden
                  />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={item.kind === "YOUTUBE" ? "secondary" : "outline"}
                >
                  {item.kind === "YOUTUBE" ? "Video" : "Photo"}
                </Badge>
                {item.isThumbnail && <Badge>Cover</Badge>}
              </div>

              {/* Only a photograph fills a slot; a video is always an extra (D4). */}
              {item.kind === "IMAGE" && (
                <Select
                  value={item.slot ?? ""}
                  onChange={(event) => assignSlot(index, event.target.value)}
                  aria-label={`Slot for item ${index + 1}`}
                >
                  <option value="">Extra photo</option>
                  {shotList.map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {slot.label}
                      {slot.hint ? ` — ${slot.hint}` : ""}
                    </option>
                  ))}
                </Select>
              )}

              <Input
                value={item.description ?? ""}
                onChange={(event) => describe(index, event.target.value)}
                placeholder="Describe this item"
                aria-label={`Description for item ${index + 1}`}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move item ${index + 1} earlier`}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => move(index, 1)}
                  disabled={index === media.length - 1}
                  aria-label={`Move item ${index + 1} later`}
                >
                  <ArrowDown className="size-4" />
                </Button>
                {/* Only a photograph can be the cover (R12) — the option is absent on a
                    video rather than present and rejected. */}
                {item.kind === "IMAGE" && !item.isThumbnail && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCover(index)}
                  >
                    <Star className="mr-1 size-4" />
                    Cover
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || atCapacity}
          className="sm:w-auto"
        >
          {isUploading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Upload className="mr-2 size-4" />
          )}
          {isUploading
            ? progress.total > 1
              ? `Uploading ${progress.done}/${progress.total}…`
              : "Uploading…"
            : "Upload photos"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={linkDraft}
          onChange={(event) => setLinkDraft(event.target.value)}
          placeholder="Paste a YouTube link"
          aria-label="YouTube link"
          disabled={atCapacity}
        />
        <Button
          type="button"
          variant="outline"
          onClick={addVideo}
          disabled={atCapacity}
        >
          <Youtube className="mr-2 size-4" />
          Add video
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        {photographCount === 0
          ? "At least one photograph is required. Video is optional."
          : `${media.length} of ${MAX_MEDIA_PER_PRODUCT} items, ${filledSlots.size} of ${shotList.length} slots filled. Tap "Cover" on the photograph that should represent this product in listings.`}{" "}
        Photos are resized in your browser before upload, so large files are
        fine.
      </p>
    </div>
  );
}
