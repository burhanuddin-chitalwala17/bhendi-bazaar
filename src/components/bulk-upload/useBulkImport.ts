"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { relativePath } from "./files";

export type BulkImportStep = "pick" | "checking" | "report" | "uploading" | "creating" | "done";

/** What `create` is handed: the picked files by path, and the call that moves the screen on to creating. */
export interface BulkImportWork {
  filesByPath: Map<string, File>;
  providedPaths: string[];
  creating: () => void;
}

/**
 * The step machine both bulk wizards share (bulk-catalog-upload R1–R3): pick a sheet and its
 * images, dry-run it, then upload-and-create. What is uploaded and created is the wizard's.
 */
export function useBulkImport<TReport extends { ok: boolean }>(
  validate: (sheet: File, filenames: string[]) => Promise<TReport>,
) {
  const [step, setStep] = useState<BulkImportStep>("pick");
  const [sheet, setSheet] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [report, setReport] = useState<TReport | null>(null);
  const [created, setCreated] = useState(0);

  const filesByPath = useMemo(() => new Map(images.map((file) => [relativePath(file), file])), [images]);
  const providedPaths = useMemo(() => [...filesByPath.keys()], [filesByPath]);

  const check = async () => {
    if (!sheet) {
      toast.error("Choose the filled-in sheet first");
      return;
    }
    setStep("checking");
    try {
      setReport(await validate(sheet, providedPaths));
      setStep("report");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check the sheet");
      setStep("pick");
    }
  };

  /** `create` uploads, calls `creating()`, creates, and answers how many were made. */
  const run = async (create: (work: BulkImportWork) => Promise<number>) => {
    setStep("uploading");
    try {
      setCreated(await create({ filesByPath, providedPaths, creating: () => setStep("creating") }));
      setStep("done");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      setStep("report");
    }
  };

  return { step, setSheet, images, setImages, report, created, providedPaths, check, run };
}
