"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProductMediaRendition } from "@server/catalog/media";
import { VIDEO_RENDITION_MIME_TYPE } from "@server/catalog/video";
import { formatDuration } from "@/lib/format";
import { pickRendition } from "@/lib/video-renditions";
import { FORM_FACTOR_QUERY } from "@/hooks/core/useMediaQuery";

/** The gallery slide's slot (ADR-0026): the full phone, then half the page (at most half of 90rem, less the rail). */
export const GALLERY_SLIDE_SIZES = "(min-width: 1024px) 42rem, (min-width: 768px) 50vw, 100vw";


interface VideoPlayerProps {
  poster: string | null;
  /** Largest first, as the DTO carries them; empty means there is nothing to play yet. */
  renditions: ProductMediaRendition[];
  durationMs: number | null;
  /** What the poster shows, for its alt and the play control's label. */
  title: string;
  /** The poster's slot as `next/image` `sizes`; the gallery slide's when absent. */
  sizes?: string;
  /** False once the surface has moved on — a swiped-away slide — so nothing keeps playing unseen. */
  active?: boolean;
}

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * A hosted video as its poster with a play control, becoming a native `<video>` only on a tap
 * (ADR-0039 decision 3; ADR-0017 decision 3, kept). Nothing here comes from another host: the
 * poster is our image through the optimizer, the file is our rendition, full screen is the
 * browser's own control. The rendition is picked by viewport once and can be switched by hand;
 * a switch keeps the viewer's place.
 */
export function VideoPlayer({
  poster,
  renditions,
  durationMs,
  title,
  sizes = GALLERY_SLIDE_SIZES,
  active = true,
}: VideoPlayerProps) {
  const [current, setCurrent] = useState<ProductMediaRendition | null>(null);
  /** Play is asked for once per mounted element; a switch remounts, and the viewer keeps control after. */
  const started = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef<number | null>(null);

  // Back to the poster the moment the surface moves on — during render, as React adjusts state
  // to a changed prop, rather than an effect that would paint a playing frame first.
  if (!active && current !== null) setCurrent(null);

  const play = () => setCurrent(pickRendition(renditions, window.matchMedia(FORM_FACTOR_QUERY.tablet).matches));

  const switchTo = (rendition: ProductMediaRendition) => {
    if (rendition.key === current?.key) return;
    resumeAt.current = videoRef.current?.currentTime ?? null;
    started.current = false;
    setCurrent(rendition);
  };

  if (current) {
    return (
      // Touches stop here while playing: a scrub on the native controls is not a swipe to the next slide.
      <div className="relative h-full w-full bg-scrim" onClick={stop} onTouchStart={stop} onTouchMove={stop} onTouchEnd={stop}>
        <video
          // Keyed on the rendition so a switch is a fresh element: changing a mounted `<source>` is ignored by the browser.
          key={current.key}
          ref={videoRef}
          controls
          playsInline
          // The element exists only because somebody tapped play, so it should load. `preload="none"`
          // told the browser the opposite and `autoPlay` then asked it to start what it had not
          // fetched; between the two the video sat at nought. Starting is asked for explicitly
          // below, and a browser that declines simply leaves its own play button.
          preload="auto"
          poster={poster ?? undefined}
          className="h-full w-full object-contain"
          onLoadedMetadata={(event) => {
            if (resumeAt.current === null) return;
            event.currentTarget.currentTime = resumeAt.current;
            resumeAt.current = null;
          }}
          onCanPlay={(event) => {
            if (started.current) return;
            started.current = true;
            void event.currentTarget.play().catch(() => undefined);
          }}
        >
          <source src={current.url} type={VIDEO_RENDITION_MIME_TYPE} />
        </video>
        {renditions.length > 1 && (
          <div
            role="group"
            aria-label="Video quality"
            className="absolute right-3 top-3 z-20 flex gap-1 rounded-field border border-primary/30 bg-scrim/80 p-1 backdrop-blur-sm"
          >
            {renditions.map((rendition) => (
              <Button
                key={rendition.key}
                type="button"
                size="sm"
                variant={rendition.key === current.key ? "default" : "ghost"}
                aria-pressed={rendition.key === current.key}
                onClick={() => switchTo(rendition)}
                className={`h-10 min-w-10 px-3 ${rendition.key === current.key ? "" : "text-hero-foreground hover:bg-hero/90 hover:text-hero-foreground"}`}
              >
                {rendition.key}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-muted">
      {poster ? (
        <Image src={poster} alt={title} fill sizes={sizes} className="object-cover select-none" draggable={false} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Icon name="video" size="xl" />
        </span>
      )}
      {durationMs !== null && (
        <Badge variant="outline" className="absolute bottom-3 left-3 z-20 border-primary/30 bg-scrim/80 text-hero-foreground backdrop-blur-sm">
          {formatDuration(durationMs)}
        </Badge>
      )}
      {/* Visible, tappable, and not dependent on hover (ADR-0015) — the same control the YouTube embed shows. */}
      {renditions.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          shape="icon" size="lg"
          onClick={(event) => {
            event.stopPropagation();
            play();
          }}
          aria-label={`Play video: ${title}`}
          className="absolute left-1/2 top-1/2 z-20 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 bg-scrim/80 text-hero-foreground backdrop-blur-sm hover:bg-hero/90"
        >
          <Icon name="play" size="lg" filled />
        </Button>
      )}
    </div>
  );
}
