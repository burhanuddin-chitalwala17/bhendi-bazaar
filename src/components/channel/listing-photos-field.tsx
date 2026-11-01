"use client";

import Image from "next/image";
import { ArrowLeft, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListingPhotoDTO, ListingRules } from "@server/channels/platform-listing.types";

import { LISTING } from "./platform-listing-copy";

/**
 * Which of the product's photos the listing uses, in order (channel-listings Q11): tap to leave one
 * out or put it back, "Move earlier" to reorder. A marketplace's photo rule warns, never blocks.
 */
export function ListingPhotosField({
  photos,
  chosen,
  rules,
  label,
  onChange,
}: {
  photos: ListingPhotoDTO[];
  chosen: string[];
  rules: ListingRules;
  label: string;
  onChange: (next: string[]) => void;
}) {
  const ordered = [...chosen.map((id) => photos.find((p) => p.id === id)).filter((p): p is ListingPhotoDTO => !!p), ...photos.filter((p) => !chosen.includes(p.id))];
  const toggle = (id: string) => {
    if (chosen.includes(id)) {
      if (chosen.length > 1) onChange(chosen.filter((c) => c !== id));
    } else onChange([...chosen, id]);
  };
  const earlier = (id: string) => {
    const i = chosen.indexOf(id);
    if (i <= 0) return;
    const next = [...chosen];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };
  const warnings = ordered
    .filter((p) => chosen.includes(p.id) && p.warning)
    .map((p) => ({ n: chosen.indexOf(p.id) + 1, p }));

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {ordered.map((photo) => {
          const position = chosen.indexOf(photo.id);
          const used = position >= 0;
          return (
            <li key={photo.id} className="flex shrink-0 flex-col items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                className={cn("relative size-16 overflow-hidden rounded-field p-0", !used && "opacity-40")}
                aria-pressed={used}
                aria-label={used ? LISTING.leaveOut : LISTING.include}
                onClick={() => toggle(photo.id)}
              >
                <Image src={photo.url} alt="" fill sizes="64px" className="object-cover" />
                {used && (
                  <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-2xs font-semibold text-primary-foreground">
                    {position + 1}
                  </span>
                )}
                {used && photo.warning && <span className="absolute right-1 top-1 size-2 rounded-full bg-warning" aria-hidden />}
                {!used && <Check className="absolute inset-0 m-auto size-5 opacity-0" aria-hidden />}
              </Button>
              {used && position > 0 && (
                <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={LISTING.moveEarlier} onClick={() => earlier(photo.id)}>
                  <ArrowLeft aria-hidden />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {chosen.length > rules.maxPhotos && rules.maxPhotos > 0 && (
        <p className="text-xs text-warning">{`${label} shows the first ${rules.maxPhotos}.`}</p>
      )}
      {warnings.map(({ n, p }) => (
        <p key={p.id} className="text-xs text-warning">
          {`Photo ${n}: `}
          {p.warning === "format" ? LISTING.photoFormat(label) : LISTING.photoSmall(label, rules.photo.minPx ?? 0, Math.max(p.width ?? 0, p.height ?? 0))}
        </p>
      ))}
    </div>
  );
}
