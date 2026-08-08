"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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
      size="icon"
      className={className}
      aria-label="Download bill"
      title="Download bill (PDF)"
      onClick={() => window.print()}
    >
      <Download className="h-4 w-4" />
    </Button>
  );
}
