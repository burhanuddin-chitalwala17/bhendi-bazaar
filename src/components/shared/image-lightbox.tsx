"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { ZoomableImage } from "@/components/shared/zoomable-image";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { IMAGE_LIGHTBOX_COPY } from "./shared-copy";

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
 *
 * Edge to edge, but the *photograph* is not: it is inset so it reads as something being
 * shown rather than something that has replaced the page, and the scrim stays partly
 * transparent for the same reason — a viewer you can see the page through is obviously
 * a layer you can dismiss. Top inset clears the close button by construction (its offset
 * plus its height), so the two cannot collide however the safe area moves.
 */
export function ImageLightbox({
  images,
  alt,
  open,
  onOpenChange,
  activeIndex,
  onIndexChange,
}: ImageLightboxProps) {
  const goTo = (index: number) => onIndexChange(index);
  const handleNext = () => goTo((activeIndex + 1) % images.length);
  const handlePrevious = () => goTo((activeIndex - 1 + images.length) % images.length);

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

  const source = images[activeIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="fixed inset-0 top-0 left-0 z-50 h-auto w-auto max-h-none max-w-none translate-x-0 translate-y-0 sm:max-w-none flex flex-col gap-0 overflow-hidden rounded-none border-0 bg-scrim/75 p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{alt} — image gallery</DialogTitle>

        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            shape="icon" size="lg"
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-30 bg-scrim/80 text-hero-foreground hover:bg-hero/90 border border-primary/30 rounded-full backdrop-blur-sm"
            aria-label={IMAGE_LIGHTBOX_COPY.closeFullView}
          >
            <Icon name="close" size="md" />
          </Button>
        </DialogClose>

        {/* The stage: pinch, wheel, drag and the minimap all live in ZoomableImage (viewer trd D7). */}
        <ZoomableImage
          src={source}
          alt={`${alt} - Image ${activeIndex + 1}`}
          onSwipeNext={handleNext}
          onSwipePrevious={handlePrevious}
          className="flex-1 px-4 pb-6 pt-[calc(3.5rem+env(safe-area-inset-top))] sm:px-10 sm:pb-8"
        />

        {/* Thumbnail strip */}
        {images.length > 1 && (
          <div className="flex shrink-0 gap-1.5 overflow-x-auto px-3 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] justify-start sm:justify-center">
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
                />
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
