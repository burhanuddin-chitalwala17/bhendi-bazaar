"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

/**
 * The one interactive atom on the bill card: print-to-PDF, where the print
 * stylesheet makes the bill the whole page. A client leaf so the summary itself
 * can stay a server component.
 */
export function DownloadBillButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      shape="icon"
      size="lg"
      className={className}
      aria-label="Download bill"
      title="Download bill (PDF)"
      onClick={() => window.print()}
    >
      <Icon name="download" size="md" />
    </Button>
  );
}
