"use client";

import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { ShareDialog } from "./ShareDialog";

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export function ShareButton({
  url,
  title,
  text,
  variant = "outline",
  size = "sm",
  className,
  showLabel,
}: ShareButtonProps) {
  // `size="icon"` is a fixed size-9 square, so a label cannot fit: the content
  // overflows and `justify-center` pushes the icon outside the box, onto whatever
  // sits beside it. Defaulted rather than left to each caller to remember.
  const withLabel = showLabel ?? size !== "icon";

  return (
    <ShareDialog url={url} title={title} text={text}>
      <Button variant={variant} size={size} className={className}>
        <Share2 className="h-4 w-4" />
        {withLabel && <span>Share</span>}
      </Button>
    </ShareDialog>
  );
}