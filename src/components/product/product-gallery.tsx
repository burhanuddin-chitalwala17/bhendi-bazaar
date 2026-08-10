"use client";

import { useState, useRef, useEffect } from "react";
import type { Product } from "@/domain/product";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/shared/image-lightbox";

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
  const images = product.images.length ? product.images : [product.thumbnail];

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
    goToIndex((prev) => (prev + 1) % images.length);
    setScale(1);
  };

  const handlePrevious = () => {
    goToIndex((prev) => (prev - 1 + images.length) % images.length);
    setScale(1);
  };

  // Mouse hover zoom for desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current || window.innerWidth < 768) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    if (window.innerWidth >= 768) {
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
    <div className="space-y-3">
      {/* Main image container */}
      <div className="relative group">
        <div
          ref={imageContainerRef}
          className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-hero via-hero/90 to-scrim cursor-zoom-in touch-pan-x touch-pan-y"
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
            {images.map((image, index) => (
              <div
                key={index}
                className="relative shrink-0 w-full h-full flex items-center justify-center"
              >
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
                    src={image}
                    alt={`${product.name} - Image ${index + 1}`}
                    fill
                    className="object-cover select-none"
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    unoptimized
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Navigation arrows - always visible on touch (hover never fires), hover-revealed on desktop */}
          {images.length > 1 && (
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
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 z-20 bg-scrim/80 backdrop-blur-sm border border-primary/30 rounded-lg px-3 py-1.5 text-xs font-medium text-hero-foreground">
              {activeIndex + 1} / {images.length}
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
        {!isZoomed && images.length > 0 && (
          <div className="absolute top-3 left-3 z-20 bg-scrim/60 backdrop-blur-sm border border-primary/20 rounded-lg px-3 py-1.5 text-xs font-medium text-hero-foreground/80 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block pointer-events-none">
            Hover to zoom
          </div>
        )}
      </div>

      {/* Thumbnail preview */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-emerald-500/30 scrollbar-track-transparent">
          {images.map((image, index) => (
            <Button
              key={index}
              type="button"
              variant="ghost"
              onClick={() => goToIndex(() => index)}
              className={`relative shrink-0 w-16 h-auto p-0 aspect-[3/4] sm:w-20 rounded-lg border-2 overflow-hidden ${
                activeIndex === index
                  ? "border-primary ring-2 ring-ring/30 scale-105"
                  : "border-border/70 hover:border-primary/50 opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={image}
                alt={`Thumbnail ${index + 1}`}
                fill
                className="object-cover"
                sizes="80px"
                unoptimized
              />
              {/* Active indicator */}
              {activeIndex === index && (
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Mobile pinch zoom instruction */}
      <div className="md:hidden text-center">
        <p className="text-xs text-muted-foreground">
          Swipe to navigate • Pinch to zoom
        </p>
      </div>

      <ImageLightbox
        images={images}
        alt={product.name}
        open={isLightboxOpen}
        onOpenChange={setIsLightboxOpen}
        activeIndex={activeIndex}
        onIndexChange={(index) => goToIndex(() => index)}
      />
    </div>
  );
}