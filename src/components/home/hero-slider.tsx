"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeroBanner, type HeroBannerContent } from "./hero-banner";
import { cn } from "@/lib/utils";

const ADVANCE_MS = 6000;

/**
 * The banner rail. Built on scroll-snap rather than a transform track, so a phone
 * gets native momentum swipe for free and the whole thing still works before the
 * JavaScript lands — the same pattern the offers strip and category lanes already use.
 *
 * `"use client"` is earned here and nowhere else in the hero: HeroBanner stays a
 * server component, and only the rail around it needs state.
 */
export function HeroSlider({ banners }: { banners: HeroBannerContent[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  // Reaching for a control is a decision to browse at your own pace; rotation that
  // resumes underneath is the one behaviour a carousel cannot argue for. It also
  // leaves a real way to stop the motion now that the pause button is gone.
  const [stopped, setStopped] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const many = banners.length > 1;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const rail = railRef.current;
      if (!rail) return;
      const target = (next + banners.length) % banners.length;
      rail.scrollTo({
        left: rail.clientWidth * target,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [banners.length, reducedMotion]
  );

  // Auto-advance stops while a pointer or the keyboard is on the rail, and never
  // starts at all when the reader has asked for reduced motion.
  useEffect(() => {
    if (!many || stopped || held || reducedMotion) return;
    const timer = setInterval(() => goTo(index + 1), ADVANCE_MS);
    return () => clearInterval(timer);
  }, [many, stopped, held, reducedMotion, index, goTo]);

  // The rail is the source of truth for which slide is showing — a swipe moves it
  // without going through goTo, so index follows scroll rather than driving it.
  const onScroll = useCallback(() => {
    const rail = railRef.current;
    if (!rail || rail.clientWidth === 0) return;
    setIndex(Math.round(rail.scrollLeft / rail.clientWidth));
  }, []);

  return (
    <section
      aria-roledescription={many ? "carousel" : undefined}
      aria-label={many ? "Featured collections" : undefined}
      className="relative"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setHeld(false)}
      onTouchCancel={() => setHeld(false)}
    >
      <div
        ref={railRef}
        onScroll={onScroll}
        aria-live={stopped || held ? "polite" : "off"}
        className={cn(
          "flex no-scrollbar",
          many && "snap-x snap-mandatory overflow-x-auto"
        )}
      >
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            role={many ? "group" : undefined}
            aria-roledescription={many ? "slide" : undefined}
            aria-label={many ? `${i + 1} of ${banners.length}` : undefined}
            className="w-full shrink-0 snap-center"
          >
            {/* The controls sit over the banner's bottom edge, which on a phone is
                exactly where the CTAs land — so reserve the room rather than overlap. */}
            <HeroBanner
              banner={banner}
              priority={i === 0}
              className={cn(many && "pb-12")}
            />
          </div>
        ))}
      </div>

      {many && (
        <>
          {/* Arrows are the pointer convenience; swipe and the dots below are the
              affordance that exists on a phone, so hiding these costs nothing. */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous banner"
            onClick={() => {
              setStopped(true);
              goTo(index - 1);
            }}
            className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-scrim/40 text-hero-foreground hover:bg-scrim/60 sm:flex"
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next banner"
            onClick={() => {
              setStopped(true);
              goTo(index + 1);
            }}
            className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-scrim/40 text-hero-foreground hover:bg-scrim/60 sm:flex"
          >
            <ChevronRight />
          </Button>

          {/* The scrim is gone at rest on desktop, so the dots carry their own ground
              — otherwise they vanish on any light-coloured artwork. */}
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <div className="flex items-center gap-1 rounded-full bg-scrim/40 px-1 backdrop-blur-sm">
            {banners.map((banner, i) => (
              <Button
                key={banner.id}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Go to banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => {
                  setStopped(true);
                  goTo(i);
                }}
                className="rounded-full hover:bg-transparent"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all",
                    i === index
                      ? "w-5 bg-hero-foreground"
                      : "w-1.5 bg-hero-foreground/50"
                  )}
                />
              </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
