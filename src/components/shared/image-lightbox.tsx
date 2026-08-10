"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const MIN_SCALE = 1;
const MAX_SCALE = 3;

interface ImageLightboxProps {
  images: string[];
  /** Base alt text, e.g. the product name */
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

/**
 * Full-screen image viewer: swipe (touch) / arrow keys to navigate, pinch or
 * scroll-wheel to zoom, drag to pan when zoomed, minimap showing the visible
 * region. Controlled: index and open state live with the caller so an inline
 * gallery stays in sync with it.
 */
export function ImageLightbox({
  images,
  alt,
  open,
  onOpenChange,
  activeIndex,
  onIndexChange,
}: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  // Pan offset as a fraction of the container size, so transforms and the
  // minimap rect need no pixel measurements at render time.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
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
    setOffset((prev) => ({
      x: clampOffset(prev.x, s),
      y: clampOffset(prev.y, s),
    }));
  };

  const panBy = (dxPx: number, dyPx: number) => {
    const el = containerRef.current;
    if (!el) return;
    setOffset((prev) => ({
      x: clampOffset(prev.x + dxPx / el.clientWidth, scale),
      y: clampOffset(prev.y + dyPx / el.clientHeight, scale),
    }));
  };

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const goTo = (index: number) => {
    resetView();
    onIndexChange(index);
  };

  const handleNext = () => goTo((activeIndex + 1) % images.length);
  const handlePrevious = () =>
    goTo((activeIndex - 1 + images.length) % images.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
      const [t1, t2] = [e.touches[0], e.touches[1]];
      pinchDistanceRef.current = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
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
      const distance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
      zoomTo(scale * (distance / pinchDistanceRef.current));
      pinchDistanceRef.current = distance;
    } else if (e.touches.length === 1 && !isPinchingRef.current) {
      const t = e.touches[0];
      if (scale > 1) {
        panBy(
          t.clientX - lastTouchRef.current.x,
          t.clientY - lastTouchRef.current.y
        );
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
    if (scale > 1) return;
    const delta = swipeStartXRef.current - swipeEndXRef.current;
    if (delta > 75) handleNext();
    if (delta < -75) handlePrevious();
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

  const handleWheel = (e: React.WheelEvent) => {
    zoomTo(scale - e.deltaY * 0.002);
  };

  // Keyboard navigation while open. Re-subscribes each render so the handlers
  // never close over a stale index.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleOpenChange = (nextOpen: boolean) => {
    resetView();
    onOpenChange(nextOpen);
  };

  // Visible region of the image in content-fraction coordinates, for the minimap.
  const viewportRect = {
    left: (0.5 - offset.x / scale - 0.5 / scale) * 100,
    top: (0.5 - offset.y / scale - 0.5 / scale) * 100,
    size: (1 / scale) * 100,
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="h-dvh max-h-none w-screen max-w-none sm:max-w-none rounded-none border-0 bg-scrim/95 p-0 gap-0 flex flex-col overflow-hidden"
      >
        <DialogTitle className="sr-only">{alt} — image gallery</DialogTitle>

        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="absolute top-3 right-3 z-30 bg-scrim/80 hover:bg-hero/90 border border-primary/30 rounded-full backdrop-blur-sm"
            aria-label="Close full view"
          >
            <X className="size-5 text-hero-foreground" />
          </Button>
        </DialogClose>

        {/* Minimap: where the visible region sits on the full image */}
        {scale > 1.01 && (
          <div className="absolute top-16 right-3 z-30 w-20 aspect-[3/4] rounded-md overflow-hidden border border-primary/40 bg-scrim/80 pointer-events-none">
            <Image
              src={images[activeIndex]}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
              unoptimized
            />
            <div
              className="absolute border-2 border-primary bg-primary/15 rounded-sm"
              style={{
                left: `${viewportRect.left}%`,
                top: `${viewportRect.top}%`,
                width: `${viewportRect.size}%`,
                height: `${viewportRect.size}%`,
              }}
            />
          </div>
        )}

        {/* Main image area */}
        <div
          ref={containerRef}
          className={`relative flex-1 min-h-0 touch-none select-none ${
            scale > 1 ? "cursor-grab" : ""
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopMouseDrag}
          onMouseLeave={stopMouseDrag}
          onWheel={handleWheel}
        >
          <div
            className="relative h-full w-full"
            style={{
              transform: `translate(${offset.x * 100}%, ${
                offset.y * 100
              }%) scale(${scale})`,
            }}
          >
            <Image
              src={images[activeIndex]}
              alt={`${alt} - Image ${activeIndex + 1}`}
              fill
              className="object-contain select-none"
              sizes="100vw"
              unoptimized
              draggable={false}
            />
          </div>
        </div>

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto p-2 justify-start sm:justify-center">
            {images.map((image, index) => (
              <Button
                key={index}
                type="button"
                variant="ghost"
                onClick={() => goTo(index)}
                className={`relative shrink-0 w-10 h-auto p-0 aspect-[3/4] sm:w-12 rounded-md border overflow-hidden ${
                  activeIndex === index
                    ? "border-primary ring-2 ring-ring/30"
                    : "border-border/70 hover:border-primary/50 opacity-70 hover:opacity-100"
                }`}
                aria-label={`View image ${index + 1}`}
              >
                <Image
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                />
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
