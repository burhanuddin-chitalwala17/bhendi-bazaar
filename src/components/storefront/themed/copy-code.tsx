"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A shop's printed code (Q20): one tap copies it. A denied clipboard still leaves the code on
 * the button for the buyer to type, so nothing is lost by failing quietly.
 */
export function CopyCode({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={copy}
      aria-live="polite"
      className={cn("border-current bg-transparent font-label tracking-tag text-current shadow-none hover:bg-transparent hover:text-current", className)}
    >
      {copied ? "Copied" : `Code ${code} · tap to copy`}
    </Button>
  );
}
