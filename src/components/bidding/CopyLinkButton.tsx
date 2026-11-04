"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { COPY_LINK_COPY } from "./bidding-copy";

/**
 * The whole point of an event is the link (spec R9), so copying it is a first-class
 * action rather than something an org does by selecting text.
 *
 * The absolute URL is built here from `window.location.origin` rather than from a
 * constant: an origin is runtime-known, and hardcoding our own is what
 * `src/lib/config.ts` deliberately refuses to hold.
 */
export function CopyLinkButton({
  path,
  label = COPY_LINK_COPY.copyLink,
  className,
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(COPY_LINK_COPY.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A denied clipboard is not a failure the org can act on, so show the URL
      // instead of an error they cannot fix.
      toast.info(url);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copy}
      className={className}
    >
      <Icon name={copied ? "done" : "copy"} />
      {copied ? COPY_LINK_COPY.copied : label}
    </Button>
  );
}
