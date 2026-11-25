"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { MAX_ZOOM_SCALE, ZOOMABLE_IMAGE_SIZES } from "@server/catalog/media";
import { SWIPE_PX } from "@/hooks/core/useHorizontalSwipe";

/** Placeholder proportions for the first paint, before the image reports its own. */
const FALLBACK_EDGE = 1600;

const MIN_SCALE = 1;
const MAX_SCALE = MAX_ZOOM_SCALE;

interface ZoomableImageProps {
  src: string;
  alt: string;
  /** An unzoomed swipe; absent where there is nowhere to go. */
  onSwipeNext?: () => void;
  onSwipePrevious?: () => void;
  onLoad?: () => void;
  onError?: () => void;
  /** The stage's padding, which is the surface's: it decides where the photograph sits. */
  className?: string;
}

/**
 * One photograph that pinches, wheels and drags, with a minimap while zoomed (viewer trd D7). Shared
 * by the product lightbox and the Library viewer, so the two cannot drift. A new `src` starts unzoomed.
 */
export function ZoomableImage({ src, alt, onSwipeNext, onSwipePrevious, onLoad, onError, className = "" }: ZoomableImageProps) {
  const [scale, setScale] = useState(1);
  // Pan offset as a fraction of the container size, so transforms and the minimap rect need no
  // pixel measurements at render time.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Keyed by `src` and read back only for that `src`, so the next photograph falls back to the hint
  // for one paint rather than briefly drawing at the previous one's proportions.
  const [measured, setMeasured] = useState<{ src: string; width: number; height: number } | null>(null);
  const [shown, setShown] = useState(src);
  if (shown !== src) {
    setShown(src);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const pinchDistanceRef = useRef(0);
  const isPinchingRef = useRef(false);
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const swipeStartXRef = useRef(0);
  const swipeEndXRef = useRef(0);
  const isMouseDraggingRef = useRef(false);

  // The image can never pan further than its own scaled overflow.
  const clampOffset = (value: number, s: number) => {
    const max = (s - 1) / 2;
    return Math.max(-max, Math.min(max, value));
  };

  const zoomTo = (next: number) => {
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    setScale(s);
    setOffset((prev) => ({ x: clampOffset(prev.x, s), y: clampOffset(prev.y, s) }));
  };

  const panBy = (dxPx: number, dyPx: number) => {
    const el = containerRef.current;
    if (!el || !el.clientWidth || !el.clientHeight) return;
    setOffset((prev) => ({
      x: clampOffset(prev.x + dxPx / el.clientWidth, scale),
      y: clampOffset(prev.y + dyPx / el.clientHeight, scale),
    }));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
      // A drag that became a pinch is not a swipe: the release must not read its stale distance.
      swipeEndXRef.current = swipeStartXRef.current;
      const [t1, t2] = [e.touches[0], e.touches[1]];
      pinchDistanceRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      lastTouchRef.current = { x: t.clientX, y: t.clientY };
      swipeStartXRef.current = t.clientX;
      swipeEndXRef.current = t.clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinchingRef.current) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      zoomTo(scale * (distance / pinchDistanceRef.current));
      pinchDistanceRef.current = distance;
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      const t = e.touches[0];
      if (scale > 1) {
        panBy(t.clientX - lastTouchRef.current.x, t.clientY - lastTouchRef.current.y);
        lastTouchRef.current = { x: t.clientX, y: t.clientY };
      } else {
        swipeEndXRef.current = t.clientX;
      }
    }
  };

  const handleTouchEnd = () => {
    if (isPinchingRef.current) {
      isPinchingRef.current = false;
      return;
    }
    // No guard on the scale here: while zoomed the move is a pan and records no swipe at all,
    // so a second check would be a rule enforced twice and tested never.
    const delta = swipeStartXRef.current - swipeEndXRef.current;
    if (delta > SWIPE_PX) onSwipeNext?.();
    if (delta < -SWIPE_PX) onSwipePrevious?.();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    isMouseDraggingRef.current = true;
    lastTouchRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDraggingRef.current) return;
    panBy(e.clientX - lastTouchRef.current.x, e.clientY - lastTouchRef.current.y);
    lastTouchRef.current = { x: e.clientX, y: e.clientY };
  };

  const stopMouseDrag = () => {
    isMouseDraggingRef.current = false;
  };

  const measurement = measured?.src === src ? measured : null;

  // Visible region of the image in content-fraction coordinates, for the minimap.
  const viewportRect = {
    left: (0.5 - offset.x / scale - 0.5 / scale) * 100,
    top: (0.5 - offset.y / scale - 0.5 / scale) * 100,
    size: (1 / scale) * 100,
  };

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-0 w-full touch-none select-none ${scale > 1 ? "cursor-grab" : ""} ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopMouseDrag}
      onMouseLeave={stopMouseDrag}
      onWheel={(e) => zoomTo(scale - e.deltaY * 0.002)}
    >
      {/* Minimap: where the visible region sits on the full image */}
      {scale > 1.01 && (
        <div className="pointer-events-none absolute top-[calc(max(0.75rem,env(safe-area-inset-top))+3.25rem)] right-3 z-30 aspect-[3/4] w-20 overflow-hidden rounded-field border border-primary/40 bg-scrim/80">
          <Image src={src} alt="" fill className="object-cover" sizes="80px" />
          <div
            className="absolute rounded-field border-2 border-primary bg-primary/15"
            style={{
              left: `${viewportRect.left}%`,
              top: `${viewportRect.top}%`,
              width: `${viewportRect.size}%`,
              height: `${viewportRect.size}%`,
            }}
          />
        </div>
      )}
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ transform: `translate(${offset.x * 100}%, ${offset.y * 100}%) scale(${scale})` }}
      >
        {/* Sized from the image rather than filling the stage, so the element's corners are the
            picture's corners and a radius shows. sizes overstates the box on purpose (ADR-0027):
            a zoom scales the bytes already downloaded rather than fetching sharper ones. */}
        <Image
          src={src}
          alt={alt}
          width={measurement?.width ?? FALLBACK_EDGE}
          height={measurement?.height ?? FALLBACK_EDGE}
          // Both axes auto, so the loaded image's own proportions decide the box.
          className="h-auto max-h-full w-auto max-w-full rounded-card object-contain select-none"
          onLoad={(event) => {
            setMeasured({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
            onLoad?.();
          }}
          onError={onError}
          sizes={ZOOMABLE_IMAGE_SIZES}
          quality={88}
          draggable={false}
        />
      </div>
    </div>
  );
}
