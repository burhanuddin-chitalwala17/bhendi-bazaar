"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaletteKey, ThemeKey } from "@server/catalog/storefront-themes";
import { LOOK_COPY } from "./look-copy";

/** The width a frame lays its page out at, so each frame's own breakpoints apply (D12). */
export const FRAME_DEVICE = {
  PHONE: { width: 390, height: 844 },
  DESKTOP: { width: 1280, height: 800 },
} as const;
type Device = (typeof FRAME_DEVICE)[keyof typeof FRAME_DEVICE];

const FRAME_STATE = { LOADING: "loading", READY: "ready", FAILED: "failed" } as const;
type FrameState = (typeof FRAME_STATE)[keyof typeof FRAME_STATE];

/**
 * One live preview of the shop (D12, Q32): the preview page in a same-origin iframe laid out at a
 * device's width and scaled to its box. The theme's pattern holds the box until the page arrives
 * (ux.md: Loading, Slow); a page that loads without the preview's marker is "Preview unavailable".
 */
export function LookFrame({
  src,
  theme,
  palette,
  title,
  device = FRAME_DEVICE.PHONE,
  failedCopy = LOOK_COPY.previewUnavailable,
  className,
}: {
  src: string;
  theme: ThemeKey;
  palette: PaletteKey;
  title: string;
  device?: Device;
  failedCopy?: string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [state, setState] = useState<FrameState>(FRAME_STATE.LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setScale(element.clientWidth / device.width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [device.width]);

  // A new look or view is a new page: show the pattern until it arrives.
  const [shownSrc, setShownSrc] = useState(src);
  if (shownSrc !== src) {
    setShownSrc(src);
    setState(FRAME_STATE.LOADING);
  }

  const onLoad = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
    let drawn = false;
    try {
      drawn = Boolean(event.currentTarget.contentDocument?.querySelector("[data-storefront-preview]"));
    } catch {
      drawn = false;
    }
    setState(drawn ? FRAME_STATE.READY : FRAME_STATE.FAILED);
  };

  return (
    <div
      ref={box}
      data-theme={theme}
      data-palette={palette}
      className={cn("relative w-full overflow-hidden rounded-card border border-border bg-theme-pattern", className)}
      style={{ aspectRatio: `${device.width} / ${device.height}` }}
    >
      {scale > 0 && (
        <iframe
          key={attempt}
          src={src}
          title={title}
          onLoad={onLoad}
          className={cn(
            "absolute left-0 top-0 origin-top-left border-0 transition-opacity duration-theme",
            state === FRAME_STATE.READY ? "opacity-100" : "opacity-0",
          )}
          style={{ width: device.width, height: device.height, transform: `scale(${scale})` }}
        />
      )}
      {state === FRAME_STATE.FAILED && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-4 text-center">
          <p className="text-sm text-muted-foreground">{failedCopy}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setState(FRAME_STATE.LOADING);
              setAttempt((n) => n + 1);
            }}
          >
            {LOOK_COPY.tryAgain}
          </Button>
        </div>
      )}
    </div>
  );
}
