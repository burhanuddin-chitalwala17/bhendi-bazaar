/**
 * The product gallery editor: photographs uploaded to Blob, videos referenced by link,
 * in an order the org sets, with one photograph designated the cover.
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

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Star, Upload, X, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MAX_MEDIA_PER_PRODUCT,
  parseYoutubeRef,
  youtubePosterUrl,
  type ProductMediaInput,
} from "@server/catalog/media";

interface ProductMediaManagerProps {
  value: ProductMediaInput[];
  onChange: (media: ProductMediaInput[]) => void;
  /** Upload route — the caller knows whose guard applies (admin vs org member). */
  endpoint?: string;
}

export function ProductMediaManager({
  value,
  onChange,
  endpoint = "/api/admin/upload",
}: ProductMediaManagerProps) {
  const media = value ?? [];
  const [isUploading, setIsUploading] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atCapacity = media.length >= MAX_MEDIA_PER_PRODUCT;
  const photographCount = media.filter((item) => item.kind === "IMAGE").length;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    if (media.length + files.length > MAX_MEDIA_PER_PRODUCT) {
      setNotice(`A product can have at most ${MAX_MEDIA_PER_PRODUCT} gallery items`);
      return;
    }

    setIsUploading(true);
    setNotice(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      const response = await fetch(`${endpoint}?type=products`, { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error?.message || body.error || "Upload failed");
      }
      const data = await response.json();
      const uploaded: ProductMediaInput[] = (data.urls as string[]).map((url) => ({
        kind: "IMAGE",
        ref: url,
        isThumbnail: false,
      }));
      // Deliberately does not designate a cover, even for the very first upload: a
      // default that stands in for a missing choice is what makes its absence
      // invisible (D17a). The org taps "Cover".
      onChange([...media, ...uploaded]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addVideo = () => {
    if (atCapacity) {
      setNotice(`A product can have at most ${MAX_MEDIA_PER_PRODUCT} gallery items`);
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

  const describe = (index: number, description: string) => {
    onChange(media.map((item, i) => (i === index ? { ...item, description } : item)));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {media.map((item, index) => (
          <div
            key={`${item.kind}-${item.ref}-${index}`}
            className="flex gap-3 rounded-lg border border-border p-3"
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.kind === "YOUTUBE" ? youtubePosterUrl(item.ref) : item.ref}
                alt=""
                className="size-full object-cover"
              />
              {item.kind === "YOUTUBE" && (
                <span className="absolute inset-0 flex items-center justify-center bg-scrim/40">
                  <Youtube className="size-5 text-hero-foreground" aria-hidden />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.kind === "YOUTUBE" ? "secondary" : "outline"}>
                  {item.kind === "YOUTUBE" ? "Video" : "Photo"}
                </Badge>
                {item.isThumbnail && <Badge>Cover</Badge>}
              </div>

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
                  <Button type="button" variant="outline" size="sm" onClick={() => setCover(index)}>
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
          {isUploading ? "Uploading…" : "Upload photos"}
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
        <Button type="button" variant="outline" onClick={addVideo} disabled={atCapacity}>
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
          : `${media.length} of ${MAX_MEDIA_PER_PRODUCT} items. Tap "Cover" on the photograph that should represent this product in listings.`}{" "}
        Max 5MB per photo.
      </p>
    </div>
  );
}
