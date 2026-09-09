"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
  label = "Copy link",
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
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // A denied clipboard is not a failure the org can act on, so show the URL
      // instead of an error they cannot fix.
      toast.info(url);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className={className}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copied" : label}
    </Button>
  );
}
