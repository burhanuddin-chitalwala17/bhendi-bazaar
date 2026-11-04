"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ShareDialog } from "./ShareDialog";
import { SHARE_BUTTON_COPY } from "./shared-copy";

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
  shape?: "default" | "icon";
  className?: string;
  showLabel?: boolean;
}

export function ShareButton({
  url,
  title,
  text,
  variant = "outline",
  size = "sm",
  shape = "default",
  className,
  showLabel,
}: ShareButtonProps) {
  // An icon-shaped button is a fixed square; a label would overflow it.
  const withLabel = showLabel ?? shape !== "icon";

  return (
    <ShareDialog url={url} title={title} text={text}>
      <Button variant={variant} size={size} shape={shape} className={className} aria-label={withLabel ? undefined : "Share"}>
        <Icon name="share" size={shape === "icon" ? "md" : "sm"} />
        {withLabel && <span>{SHARE_BUTTON_COPY.share}</span>}
      </Button>
    </ShareDialog>
  );
}
