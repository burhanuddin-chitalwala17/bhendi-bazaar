"use client";

import { useState, useRef, useEffect } from "react";
import type { Product } from "@/domain/product";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/shared/image-lightbox";
import { YouTubeEmbed } from "@/components/product/youtube-embed";
import { youtubePosterUrl } from "@server/catalog/media";

export function ProductGallery(product: Product) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  // A swipe or pinch also fires a click on touch devices; this keeps it from opening the lightbox.
  const gestureRef = useRef(false);

  // The gallery is the org's own sequence, video included (R2/R16). A product always has
  // at least one photograph (R15), so the fallback covers only a read that predates the
  // media table.
  const media =
    product.media.length > 0
      ? product.media
      : [{ id: "cover", kind: "IMAGE" as const, ref: product.thumbnail, description: null, isThumbnail: true }];

  // Zoom, pinch, and the lightbox are photograph behaviours; a video slide owns its own
  // gestures. Keeping a separate list of the photographs is what lets the lightbox stay
  // an image viewer rather than learning about kinds.
  const photographs = media.filter((item) => item.kind === "IMAGE");
  const activeItem = media[activeIndex] ?? media[0];
  const isVideoSlide = activeItem.kind === "YOUTUBE";
  const photographIndexOf = (mediaIndex: number) =>
    media.slice(0, mediaIndex + 1).filter((item) => item.kind === "IMAGE").length - 1;

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    gestureRef.current = false;
    if (e.touches.length === 2) {
      setIsPinching(true);
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchStart(distance);
    } else if (e.touches.length === 1) {
      setTouchStart(e.targetTouches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setTouchEnd(distance);

      const newScale = Math.max(
        1,
        Math.min(3, scale * (distance / touchStart))
      );
      setScale(newScale);
      setTouchStart(distance);
    } else if (e.touches.length === 1 && !isPinching) {
      setTouchEnd(e.targetTouches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    if (isPinching) {
      gestureRef.current = true;
      setIsPinching(false);
      return;
    }

    if (touchStart - touchEnd > 75) {
      // Swipe left - next image
      gestureRef.current = true;
      handleNext();
    }

    if (touchStart - touchEnd < -75) {
      // Swipe right - previous image
      gestureRef.current = true;
      handlePrevious();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const openLightbox = () => {
    if (gestureRef.current) {
      gestureRef.current = false;
      return;
    }
    // A tap on a video plays it; it must not also open an image viewer (R4).
    if (isVideoSlide) return;
    setScale(1);
    setIsZoomed(false);
    setIsLightboxOpen(true);
  };

  // Resets zoom as part of the interaction, not in an effect. Takes an updater
  // so the keyboard effect (empty deps) can't capture a stale index.
  const goToIndex = (compute: (prev: number) => number) => {
    setActiveIndex(compute);
    setScale(1);
    setIsZoomed(false);
  };

  const handleNext = () => {
    goToIndex((prev) => (prev + 1) % media.length);
    setScale(1);
  };

  const handlePrevious = () => {
    goToIndex((prev) => (prev - 1 + media.length) % media.length);
    setScale(1);
  };

  // Mouse hover zoom for desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current || window.innerWidth < 768 || isVideoSlide) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    if (window.innerWidth >= 768 && !isVideoSlide) {
      setIsZoomed(true);
    }
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
  };

  // Keyboard navigation. Suspended while the lightbox is open — it owns the
  // arrow keys then, and two listeners would advance the index twice.
  useEffect(() => {
    if (isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen]);

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Edge-to-edge on a phone — the gutter around a hero image is the clearest
          "this is a web page" tell, and 24px of it is 24px off the product. */}
      <div className="group relative -mx-3 sm:mx-0">
        <div
          ref={imageContainerRef}
          className={`relative aspect-[3/4] overflow-hidden ${isVideoSlide ? "cursor-default" : "cursor-zoom-in"} border-border/70 bg-gradient-to-b from-hero via-hero/90 to-scrim touch-pan-x touch-pan-y sm:rounded-2xl sm:border`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={openLightbox}
        >
          {/* Decorative gradient overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,250,249,0.12),transparent_55%)] pointer-events-none z-10" />

          {/* Image slider */}
          <div
            className="relative flex h-full transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${activeIndex * 100}%)`,
            }}
          >
            {media.map((item, index) => (
              <div
                key={item.id}
                className="relative shrink-0 w-full h-full flex items-center justify-center"
              >
                {item.kind === "YOUTUBE" ? (
                  <YouTubeEmbed
                    ref_={item.ref}
                    description={item.description}
                    productName={product.name}
                  />
                ) : (
                  <div
                    className="relative w-full h-full transition-transform duration-200 ease-out"
                    style={{
                      transform: `scale(${
                        index === activeIndex ? (isZoomed ? 2 : scale) : 1
                      })`,
                      transformOrigin: isZoomed
                        ? `${mousePosition.x}% ${mousePosition.y}%`
                        : "center",
                    }}
                  >
                    <Image
                      src={item.ref}
                      // The org's own words when they exist; a position is not a
                      // description (R7).
                      alt={item.description ?? `${product.name} - Image ${index + 1}`}
                      fill
                      className="object-cover select-none"
                      loading={index === 0 ? "eager" : "lazy"}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      unoptimized
                      draggable={false}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navigation arrows - always visible on touch (hover never fires), hover-revealed on desktop */}
          {media.length > 1 && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-scrim/80 hover:bg-hero/90 border border-primary/30 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5 text-hero-foreground" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-scrim/80 hover:bg-hero/90 border border-primary/30 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 backdrop-blur-sm"
                aria-label="Next image"
              >
                <ChevronRight className="size-5 text-hero-foreground" />
              </Button>
            </>
          )}

          {/* Image counter */}
          {media.length > 1 && (
            <div className="absolute bottom-3 right-3 z-20 bg-scrim/80 backdrop-blur-sm border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-medium text-hero-foreground">
              {activeIndex + 1} / {media.length}
            </div>
          )}

          {/* Zoom indicator for mobile */}
          {scale > 1 && (
            <div className="absolute top-3 right-3 z-20 bg-scrim/80 backdrop-blur-sm border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-medium text-hero-foreground">
              {Math.round(scale * 100)}%
            </div>
          )}
        </div>

        {/* Desktop hover zoom hint */}
        {!isZoomed && media.length > 0 && (
          <div className="absolute top-3 left-3 z-20 bg-scrim/60 backdrop-blur-sm border border-primary/20 rounded-lg px-3 py-1.5 text-xs font-medium text-hero-foreground/80 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block pointer-events-none">
            Hover to zoom
          </div>
        )}
      </div>

      {/* Thumbnail preview */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {media.map((item, index) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onClick={() => goToIndex(() => index)}
              className={`relative shrink-0 w-16 h-auto p-0 aspect-[3/4] sm:w-20 rounded-lg border-2 overflow-hidden ${
                activeIndex === index
                  ? "border-primary ring-2 ring-ring/30 scale-105"
                  : "border-border/70 hover:border-primary/50 opacity-70 hover:opacity-100"
              }`}
              aria-label={
                item.description ??
                (item.kind === "YOUTUBE" ? `Video ${index + 1}` : `Image ${index + 1}`)
              }
            >
              <Image
                src={item.kind === "YOUTUBE" ? youtubePosterUrl(item.ref) : item.ref}
                alt=""
                fill
                className="object-cover"
                sizes="80px"
                unoptimized
              />
              {/* A video is identifiable before it is opened, without hover (R4). */}
              {item.kind === "YOUTUBE" && (
                <span className="absolute inset-0 z-10 flex items-center justify-center bg-scrim/40">
                  <Play className="size-5 fill-hero-foreground text-hero-foreground" aria-hidden />
                </span>
              )}
              {/* Active indicator */}
              {activeIndex === index && (
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Mobile pinch zoom instruction */}
      <div className="text-center md:hidden">
        <p className="text-[0.625rem] text-muted-foreground/70">
          Swipe to navigate • Pinch to zoom
        </p>
      </div>

      {/* The lightbox stays an image viewer: it is handed the photographs only, and its
          index is translated in and out, so it never learns about media kinds. */}
      <ImageLightbox
        images={photographs.map((item) => item.ref)}
        alt={product.name}
        open={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
        activeIndex={Math.max(0, photographIndexOf(activeIndex))}
        onIndexChange={(photographIndex) => {
          const target = media.indexOf(photographs[photographIndex]);
          if (target >= 0) goToIndex(() => target);
        }}
      />
    </div>
  );
}