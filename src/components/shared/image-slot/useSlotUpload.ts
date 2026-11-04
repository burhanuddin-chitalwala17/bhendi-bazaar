"use client";

import { useState } from "react";

import { useMutation } from "@/hooks/core/useMutation";
import { IMAGE_FIT, isOffShape, largestFrame, describeShapeProblem, type SlotShape } from "@server/catalog/image-slots";
import type { ImageSlotSideValue } from "@server/catalog/image-framing";
import { readFileDimensions } from "./measure";

/**
 * One form factor's upload: measure the file, upload it through the caller's endpoint, and start it
 * framed — centred at the slot's shape when it is off, which Keep it exact then lets the uploader
 * move (spec R3). A soft picture is said, not refused (owner rule: warn, never gate on a guess).
 */
export function useSlotUpload(shape: SlotShape, upload: (file: File) => Promise<string>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation(upload, { showToast: false });

  const run = async (file: File | undefined): Promise<ImageSlotSideValue | null> => {
    if (!file) return null;
    setError(null);
    setNotice(null);
    const size = await readFileDimensions(file);
    if (!size) {
      setError("That file could not be read as a picture.");
      return null;
    }
    try {
      const url = await mutation.mutate(file);
      setNotice(describeShapeProblem(size.width, size.height, shape));
      const off = isOffShape(size.width, size.height, shape);
      return {
        url,
        width: size.width,
        height: size.height,
        fit: IMAGE_FIT.CROP,
        crop: off ? largestFrame(size.width, size.height, shape) : null,
        fill: null,
      };
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Upload failed.");
      return null;
    }
  };

  return { run, uploading: mutation.isLoading, notice, error };
}
