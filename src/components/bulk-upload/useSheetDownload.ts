"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { bulkImportApiClient } from "./bulkImportApiClient";

export type SheetDownloadStatus = "idle" | "making" | "failed";

export const SHEET_COPY = {
  REFUSED: "Tick at least one thing you sell, so the sheet has the right columns.",
  MAKING: "Making your sheet…",
  DONE: "Sheet downloaded. Open it, fill it, then come back here.",
  FAILED: "Couldn't make your sheet. Try again.",
} as const;

const SLOW_MS = 3000;
const lastKey = (orgId: string) => `bb:bulk-sheet:last-downloaded:${orgId}`;

/** A nudge, not a record (Q29): storage that throws or is empty just means first use. */
function readLast(orgId: string): string | null {
  try {
    return window.localStorage.getItem(lastKey(orgId));
  } catch {
    return null;
  }
}

function writeLast(orgId: string, iso: string) {
  try {
    window.localStorage.setItem(lastKey(orgId), iso);
  } catch {
    // The nudge is lost on this device; the download itself succeeded.
  }
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking at once can cancel the download on iOS Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The Get the sheet step's state: ticks, the download, and when this device last downloaded. */
export function useSheetDownload(orgId: string, soldIds: string[], onDownloaded: () => void) {
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(soldIds));
  const [status, setStatus] = useState<SheetDownloadStatus>("idle");
  const [slow, setSlow] = useState(false);
  const [refused, setRefused] = useState(false);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);
  const making = useRef(false);

  useEffect(() => setLastDownloaded(readLast(orgId)), [orgId]);

  const toggle = (id: string, on: boolean) => {
    setRefused(false);
    setTicked((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const download = async () => {
    if (ticked.size === 0) {
      setRefused(true);
      return;
    }
    // The button stays live (never disabled); a second tap while making says so instead.
    if (making.current) {
      toast(SHEET_COPY.MAKING);
      return;
    }
    making.current = true;
    setStatus("making");
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    try {
      save(await bulkImportApiClient.downloadProductSheet(orgId, [...ticked]), "bulk-products-sheet.xlsx");
      const now = new Date().toISOString();
      writeLast(orgId, now);
      setLastDownloaded(now);
      setStatus("idle");
      toast.success(SHEET_COPY.DONE);
      onDownloaded();
    } catch {
      setStatus("failed");
    } finally {
      clearTimeout(timer);
      setSlow(false);
      making.current = false;
    }
  };

  return { ticked, toggle, download, status, slow, refused, lastDownloaded };
}
