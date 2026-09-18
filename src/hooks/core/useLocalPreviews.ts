"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shows a just-uploaded image from the file still in the browser, rather than fetching
 * the copy that was sent to Blob.
 *
 * An upload preview that renders the returned Blob URL pays egress for bytes the page
 * already holds — and it is the admin surfaces, uploading in bulk, that pay it most
 * (ADR-0026). Keyed by the returned URL so a caller that only knows the URL can still
 * ask for the local stand-in.
 */
export function useLocalPreviews() {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const created = useRef<string[]>([]);

  // Revoke on unmount, not per removed item: a caller may drop a URL from its list and
  // put it back (a reorder, a failed save reverting) while the component stays mounted.
  useEffect(() => {
    const urls = created.current;
    return () => urls.forEach(URL.revokeObjectURL);
  }, []);

  /** Pair the files just sent with the URLs the upload returned, in order. */
  const remember = useCallback((files: File[], urls: string[]) => {
    const added: Record<string, string> = {};
    urls.forEach((url, index) => {
      const file = files[index];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      created.current.push(objectUrl);
      added[url] = objectUrl;
    });
    setPreviews((current) => ({ ...current, ...added }));
  }, []);

  /** The local object URL for `url` if this session uploaded it, else null. */
  const localPreview = useCallback((url: string) => previews[url] ?? null, [previews]);

  return { remember, localPreview };
}
