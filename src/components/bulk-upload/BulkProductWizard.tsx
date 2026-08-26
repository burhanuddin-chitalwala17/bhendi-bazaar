"use client";

/**
 * The bulk-upload wizard (bulk-catalog-upload R1–R3): sheet + images in, one
 * validation report, then upload-and-create. Images go browser → Blob directly
 * (D10); nothing is created until the sheet validated clean.
 *
 * Mobile-first: both pickers are native file inputs (the photo picker on a
 * phone), the report and match list are single-column, and the primary action
 * docks above the tab bar (ADR-0015/0016).
 */
import { useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/api-error";
import type { BulkProductRow, RowError } from "@server/catalog/bulk/bulk.types";
import { matchingPaths } from "@server/catalog/bulk/image-match";
import { imagesOnly, relativePath, sanitizePath } from "./files";

interface ValidateResponse {
  ok: boolean;
  errors: RowError[];
  rows: { rowNumber: number; row: BulkProductRow }[];
  orgCode: string | null;
  summary: { rows: number; images: number };
}

type Step = "pick" | "checking" | "report" | "uploading" | "creating" | "done";

export function BulkProductWizard({ orgId }: { orgId: string }) {
  const [step, setStep] = useState<Step>("pick");
  const [sheet, setSheet] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [report, setReport] = useState<ValidateResponse | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [created, setCreated] = useState(0);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const filesByPath = useMemo(
    () => new Map(images.map((file) => [relativePath(file), file])),
    [images]
  );
  const providedPaths = useMemo(() => [...filesByPath.keys()], [filesByPath]);

  const check = async () => {
    if (!sheet) {
      toast.error("Choose the filled-in sheet first");
      return;
    }
    setStep("checking");
    try {
      const formData = new FormData();
      formData.append("sheet", sheet);
      formData.append("filenames", JSON.stringify(providedPaths));
      const response = await fetch(`/api/org/${orgId}/products/bulk/validate`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const body = (await response.json()) as ValidateResponse;
      setReport(body);
      setStep("report");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check the sheet");
      setStep("pick");
    }
  };

  const createAll = async () => {
    if (!report?.ok || !report.orgCode) return;
    const needed = [...new Set(report.rows.flatMap(({ row }) => row.images))];
    setProgress({ done: 0, total: needed.length });
    setStep("uploading");
    try {
      // A small queue, not a 3000-promise stampede: a phone's radio and the
      // token route both prefer bounded concurrency.
      const urls = new Map<string, string>();
      const queue = [...needed];
      let done = 0;
      const worker = async () => {
        for (let reference = queue.shift(); reference; reference = queue.shift()) {
          // Validation already proved each reference names exactly one file.
          const [path] = matchingPaths(reference, providedPaths);
          const file = path ? filesByPath.get(path) : undefined;
          if (!file) throw new Error(`Missing file "${reference}"`);
          const blob = await upload(
            `products/${report.orgCode!.toLowerCase()}/bulk/${sanitizePath(path)}`,
            file,
            { access: "public", handleUploadUrl: `/api/org/${orgId}/upload/token` }
          );
          urls.set(reference, blob.url);
          done += 1;
          setProgress({ done, total: needed.length });
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));

      setStep("creating");
      const rows = report.rows.map(({ row }) => ({
        ...row,
        imageUrls: Object.fromEntries(row.images.map((name) => [name, urls.get(name)!])),
      }));
      const response = await fetch(`/api/org/${orgId}/products/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      const body = (await response.json()) as { created: number };
      setCreated(body.created);
      setStep("done");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      setStep("report");
    }
  };

  if (step === "done") {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-lg font-semibold">✅ {created} products created</p>
        <Button asChild>
          <a href={`/org/${orgId}/products`}>View products</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">1 · The filled-in sheet</p>
          <p className="text-xs text-muted-foreground">
            .xlsx or .csv —{" "}
            <a className="underline" href={`/api/org/${orgId}/products/bulk/sample`}>
              download the sample
            </a>{" "}
            made for your locations and categories.
          </p>
        </div>
        <input
          ref={sheetInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          onChange={(e) => setSheet(e.target.files?.[0] ?? null)}
        />

        <div className="space-y-1 pt-2">
          <p className="text-sm font-medium">2 · The product photos</p>
          <p className="text-xs text-muted-foreground">
            A folder keeps each product&apos;s photos apart, so two products can both
            have a <code>front.jpg</code> — write the folder in the sheet as{" "}
            <code>emerald-abaya/front.jpg</code>. A flat selection works too when
            every filename is different.
          </p>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            Choose a folder
            <input
              type="file"
              webkitdirectory=""
              multiple
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              onChange={(e) => setImages(imagesOnly(e.target.files))}
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            …or pick photos individually
            <input
              type="file"
              accept="image/*"
              multiple
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-secondary-foreground"
              onChange={(e) => setImages(imagesOnly(e.target.files))}
            />
          </label>
        </div>
        {images.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {images.length} files selected
            {providedPaths.some((path) => path.includes("/")) ? ", with folders" : ""}
          </p>
        )}
      </section>

      {step === "report" && report && !report.ok && (
        <section className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4">
          <p className="text-sm font-semibold text-destructive">
            {report.errors.length} problem{report.errors.length === 1 ? "" : "s"} — nothing was created
          </p>
          <ul className="max-h-overlay space-y-1 overflow-y-auto text-sm">
            {report.errors.map((error, i) => (
              <li key={i}>
                <span className="font-medium">
                  {error.row === 0 ? "Sheet" : `Row ${error.row}`} · {error.field}:
                </span>{" "}
                {error.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === "report" && report?.ok && (
        <section className="space-y-2 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">
            ✓ Sheet is clean — {report.rows.length} products, {report.summary.images} images
          </p>
          <ul className="max-h-overlay space-y-1 overflow-y-auto text-sm">
            {report.rows.map(({ row, rowNumber }) => (
              <li key={rowNumber} className="flex items-center justify-between gap-2">
                <span className="truncate">{row.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.images.length} photo{row.images.length === 1 ? "" : "s"}
                  {row.videoRef ? " + video" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(step === "uploading" || step === "creating") && (
        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          {step === "uploading"
            ? `Uploading photos… ${progress.done}/${progress.total}`
            : "Creating products…"}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-tabbar z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        {step === "report" && report?.ok ? (
          <Button className="w-full md:w-auto" onClick={createAll}>
            Create {report.rows.length} products
          </Button>
        ) : (
          <Button
            className="w-full md:w-auto"
            onClick={check}
            disabled={step === "checking" || step === "uploading" || step === "creating"}
          >
            {step === "checking" ? "Checking…" : "Check the sheet"}
          </Button>
        )}
      </div>
    </div>
  );
}
