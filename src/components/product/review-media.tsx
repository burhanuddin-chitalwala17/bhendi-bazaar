"use client";

import { useState } from "react";
import Image from "next/image";

import { ImageLightbox } from "@/components/shared/image-lightbox";
import { Button } from "@/components/ui/button";
import type { ReviewMediaDto } from "@server/catalog/review.types";

/**
 * Thumbnail sizes the three surfaces use. A closed set rather than a number, because a
 * Tailwind class cannot be built at runtime and `sizes` has to match what is rendered
 * (ADR-0026) — keeping the pair together here is what stops them drifting apart.
 */
const THUMBNAILS = {
  /** The moderation table, where the picture is a glance beside the words. */
  sm: { box: "size-12", sizes: "48px" },
  /** A review as a buyer or an org reads it. */
  md: { box: "size-18", sizes: "72px" },
  /** The moderation detail panel, where the picture is the thing being judged. */
  lg: { box: "size-28", sizes: "112px" },
} as const;

export type ReviewThumbnailSize = keyof typeof THUMBNAILS;

/**
 * A review's own photographs (review-media R5a, R7, R8).
 *
 * Plainly the reviewer's: it renders inside their review, it is announced as theirs, and
 * it never reaches the product's gallery, cover or tile — the product's representation
 * stays the org's choice, so this component is only ever mounted by a review.
 *
 * Tapping one opens the same `ImageLightbox` the product gallery opens (full screen,
 * pinch and wheel zoom, swipe and arrow keys, a strip when there is more than one).
 * It used to open a default `DialogContent` instead — a small centred box with no zoom —
 * which is the one place a buyer most wants to look closely, since judging weave and
 * stonework off somebody's phone photograph is the whole reason the photograph is there.
 *
 * **All three surfaces mount this one component**: the product page, the moderation
 * queue and the org portal. A moderator deciding whether a picture may stay, and an org
 * seeing what was posted against its product, need to look at least as closely as the
 * buyer does — and a second viewer built for either would be the copy that rots.
 *
 * `sizes` stays honest at 72px for the thumbnail (ADR-0026). The lightbox declares
 * `ZOOMABLE_IMAGE_SIZES` for itself, which it is entitled to: a review photograph is
 * reduced to the same `MAX_IMAGE_EDGE` ceiling as a product's, so the stored image
 * clears `MAX_ZOOM_SCALE` exactly as ADR-0027 requires.
 *
 * Photographs only. A review carries no video — see `reviewSubmissionSchema` for why a
 * link to content the platform cannot see or take down is a cost it accepts from its own
 * orgs and not from strangers.
 */
export function ReviewMedia({
  media,
  authorName,
  size = "md",
}: {
  media: ReviewMediaDto[];
  authorName: string;
  size?: ReviewThumbnailSize;
}) {
  const [openedIndex, setOpenedIndex] = useState<number | null>(null);

  const photos = media.filter((item) => item.kind === "IMAGE");
  if (photos.length === 0) return null;

  const thumbnail = THUMBNAILS[size];

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <li key={photo.ref}>
            <Button
              type="button"
              variant="ghost"
              // Overrides Button's padding and height: the control *is* the picture.
              className={`relative ${thumbnail.box} overflow-hidden rounded-card p-0`}
              aria-label={`Open photo ${index + 1} from ${authorName}'s review`}
              onClick={() => setOpenedIndex(index)}
            >
              <Image
                src={photo.ref}
                alt={`Photo ${index + 1} from ${authorName}'s review`}
                fill
                sizes={thumbnail.sizes}
                className="object-cover"
              />
            </Button>
          </li>
        ))}
      </ul>

      <ImageLightbox
        images={photos.map((photo) => photo.ref)}
        alt={`${authorName}'s review`}
        open={openedIndex !== null}
        onOpenChange={(open) => setOpenedIndex(open ? (openedIndex ?? 0) : null)}
        activeIndex={openedIndex ?? 0}
        onIndexChange={setOpenedIndex}
      />
    </div>
  );
}
