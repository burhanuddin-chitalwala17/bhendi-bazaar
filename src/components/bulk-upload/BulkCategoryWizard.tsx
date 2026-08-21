"use client";

/**
 * Admin bulk category upload — the category variant of the product wizard, same
 * contract: validate everything first, upload hero images browser → Blob, then
 * one all-or-nothing create.
 */
import { useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/api-error";
import type { RowError } from "@server/catalog/bulk/bulk.types";
import type { BulkCategoryRow } from "@server/catalog/bulk/bulk-category.service";
import { matchingPaths } from "@server/catalog/bulk/image-match";
import { imagesOnly, relativePath, sanitizePath } from "./files";

interface ValidateResponse {
  ok: boolean;
  errors: RowError[];
  rows: { rowNumber: number; row: BulkCategoryRow }[];
  summary: { rows: number };
}

type Step = "pick" | "checking" | "report" | "uploading" | "creating" | "done";

export function BulkCategoryWizard() {
  const [step, setStep] = useState<Step>("pick");
  const [sheet, setSheet] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [report, setReport] = useState<ValidateResponse | null>(null);
  const [created, setCreated] = useState(0);

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
      const response = await fetch("/api/admin/categories/bulk/validate", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error((await readApiError(response)).message);
      setReport((await response.json()) as ValidateResponse);
      setStep("report");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check the sheet");
      setStep("pick");
    }
  };

  const createAll = async () => {
    if (!report?.ok) return;
    setStep("uploading");
    try {
      const urls = new Map<string, string>();
      for (const { row } of report.rows) {
        if (urls.has(row.image)) continue;
        const [path] = matchingPaths(row.image, providedPaths);
        const file = path ? filesByPath.get(path) : undefined;
        if (!file) throw new Error(`Missing file "${row.image}"`);
        const blob = await upload(`categories/bulk/${sanitizePath(path)}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload/token",
        });
        urls.set(row.image, blob.url);
      }

      setStep("creating");
      const rows = report.rows.map(({ row }) => ({ ...row, imageUrl: urls.get(row.image)! }));
      const response = await fetch("/api/admin/categories/bulk", {
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
        <p className="text-lg font-semibold">✅ {created} categories created</p>
        <Button asChild>
          <a href="/admin/categories">View categories</a>
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
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file
                download, not navigation: Link would route client-side instead. */}
            <a className="underline" href="/api/admin/categories/bulk/sample">
              download the sample
            </a>
            .
          </p>
        </div>
        <input
          type="file"
          accept=".xlsx,.csv"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          onChange={(e) => setSheet(e.target.files?.[0] ?? null)}
        />
        <div className="space-y-1 pt-2">
          <p className="text-sm font-medium">2 · The hero images</p>
          <p className="text-xs text-muted-foreground">
            A folder or individual files — write the folder in the sheet
            (<code>abayas/hero.jpg</code>) when two rows share a filename.
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
            …or pick images individually
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
          <p className="text-xs text-muted-foreground">{images.length} files selected</p>
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
          <p className="text-sm font-semibold">✓ Sheet is clean — {report.rows.length} categories</p>
          <ul className="max-h-overlay space-y-1 overflow-y-auto text-sm">
            {report.rows.map(({ row, rowNumber }) => (
              <li key={rowNumber} className="flex items-center justify-between gap-2">
                <span className="truncate">{row.name}</span>
                {row.parent && (
                  <span className="shrink-0 text-xs text-muted-foreground">under {row.parent}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(step === "uploading" || step === "creating") && (
        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          {step === "uploading" ? "Uploading hero images…" : "Creating categories…"}
        </section>
      )}

      <div className="fixed inset-x-0 bottom-tabbar z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        {step === "report" && report?.ok ? (
          <Button className="w-full md:w-auto" onClick={createAll}>
            Create {report.rows.length} categories
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
