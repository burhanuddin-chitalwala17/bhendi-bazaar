"use client";

import { useState } from "react";
import Image from "next/image";
import { Play, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl, youtubePosterUrl } from "@server/catalog/media";

interface YouTubeEmbedProps {
  ref_: string;
  /** R7 — the org's own description, not "video 2 of 5". */
  description: string | null;
  productName: string;
}

/**
 * A YouTube video as a poster with a play button, becoming an iframe only on a tap.
 *
 * The player is several hundred kilobytes of third-party script, so mounting it on load
 * would spend the product page's paint budget on something most visitors never press
 * ([ADR-0017](../../../docs/adr/0017-video-is-embedded-not-hosted.md) decision 3).
 *
 * The unavailable state is a requirement, not an edge case: the video belongs to
 * whoever uploaded it and can be deleted, made private, or un-embedded at any time
 * (product-video R13). A failed poster is the only signal available before playing.
 */
export function YouTubeEmbed({ ref_, description, productName }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  if (unavailable) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted px-4 text-center">
        <VideoOff className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">This video is no longer available</p>
      </div>
    );
  }

  if (playing) {
    return (
      <iframe
        src={youtubeEmbedUrl(ref_)}
        title={description ?? `${productName} video`}
        className="h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <Image
        src={youtubePosterUrl(ref_)}
        alt={description ?? `${productName} video`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        unoptimized
        onError={() => setUnavailable(true)}
      />
      {/* Visible, tappable, and not dependent on hover (ADR-0015). */}
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        onClick={(event) => {
          event.stopPropagation();
          setPlaying(true);
        }}
        aria-label={description ? `Play: ${description}` : `Play video of ${productName}`}
        className="absolute left-1/2 top-1/2 z-20 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 bg-scrim/80 backdrop-blur-sm hover:bg-hero/90"
      >
        <Play className="size-6 fill-hero-foreground text-hero-foreground" />
      </Button>
    </div>
  );
}
