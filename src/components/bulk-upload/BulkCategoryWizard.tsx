"use client";

/**
 * Admin bulk category upload — the category variant of the product wizard, same
 * contract: validate everything first, upload hero images browser → object store, then
 * one all-or-nothing create.
 */
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ActionBar } from "@/components/shared/action-bar";
import { matchingPaths } from "@server/catalog/bulk/image-match";
import { imagesOnly, sanitizePath } from "./files";
import { bulkImportApiClient } from "./bulkImportApiClient";
import { useBulkImport } from "./useBulkImport";
import { downscaleImage, storedPathFor } from "@/lib/image/downscale";
import { uploadDirect } from "@/lib/image/upload-direct";
import { ADMIN_UPLOAD_ENDPOINTS } from "@/lib/image/upload-endpoints";
import { BULK_CATEGORY_COPY } from "./bulk-copy";
import { ROUTES } from "@server/shared/routes";

export function BulkCategoryWizard() {
  const { step, setSheet, images, setImages, report, created, check, run } = useBulkImport(
    bulkImportApiClient.validateCategories,
  );

  const createAll = async () => {
    if (!report?.ok) return;
    await run(async ({ filesByPath, providedPaths, creating }) => {
      const urls = new Map<string, string>();
      for (const { row } of report.rows) {
        if (urls.has(row.image)) continue;
        const [path] = matchingPaths(row.image, providedPaths);
        const file = path ? filesByPath.get(path) : undefined;
        if (!file) throw new Error(BULK_CATEGORY_COPY.missingFile(row.image));
        // As in BulkProductWizard: a browser-direct upload is past the server's reach.
        const hero = await downscaleImage(file);
        const { url } = await uploadDirect(
          `categories/bulk/${storedPathFor(sanitizePath(path), hero)}`,
          hero,
          ADMIN_UPLOAD_ENDPOINTS,
        );
        urls.set(row.image, url);
      }

      creating();
      const rows = report.rows.map(({ row }) => ({
        ...row,
        imageUrl: urls.get(row.image)!,
      }));
      return bulkImportApiClient.createCategories(rows);
    });
  };

  if (step === "done") {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-lg font-semibold">{BULK_CATEGORY_COPY.created(created)}</p>
        <Button asChild>
          <a href={ROUTES.admin.categories}>{BULK_CATEGORY_COPY.viewCategories}</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">{BULK_CATEGORY_COPY.sheetStep}</p>
          <p className="text-xs text-muted-foreground">
            {BULK_CATEGORY_COPY.sheetFormats}{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a file
                download, not navigation: Link would route client-side instead. */}
            <a className="underline" href="/api/admin/categories/bulk/sample">
              {BULK_CATEGORY_COPY.downloadSample}
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
          <p className="text-sm font-medium">{BULK_CATEGORY_COPY.imagesStep}</p>
          <p className="text-xs text-muted-foreground">
            {BULK_CATEGORY_COPY.imagesHintBefore}
            <code>{BULK_CATEGORY_COPY.imagesExample}</code>{BULK_CATEGORY_COPY.imagesHintAfter}
          </p>
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-medium text-muted-foreground">
            {BULK_CATEGORY_COPY.chooseFolder}
            <input
              type="file"
              webkitdirectory=""
              multiple
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              onChange={(e) => setImages(imagesOnly(e.target.files))}
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            {BULK_CATEGORY_COPY.pickIndividually}
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
            {BULK_CATEGORY_COPY.filesSelected(images.length)}
          </p>
        )}
      </section>

      {step === "report" && report && !report.ok && (
        <section className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4">
          <p className="text-sm font-semibold text-destructive">
            {BULK_CATEGORY_COPY.problems(report.errors.length)}
          </p>
          <ul className="max-h-overlay space-y-1 overflow-y-auto text-sm">
            {report.errors.map((error, i) => (
              <li key={i}>
                <span className="font-medium">
                  {error.row === 0 ? BULK_CATEGORY_COPY.sheet : BULK_CATEGORY_COPY.row(error.row)} ·{" "}
                  {error.field}:
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
            {BULK_CATEGORY_COPY.clean(report.rows.length)}
          </p>
          <ul className="max-h-overlay space-y-1 overflow-y-auto text-sm">
            {report.rows.map(({ row, rowNumber }) => (
              <li
                key={rowNumber}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{row.name}</span>
                {row.parent && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {BULK_CATEGORY_COPY.under(row.parent)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(step === "uploading" || step === "creating") && (
        <section className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <Spinner />
          {step === "uploading"
            ? BULK_CATEGORY_COPY.uploading
            : BULK_CATEGORY_COPY.creating}
        </section>
      )}

      <ActionBar className="-mx-4 md:mx-0">
        {step === "report" && report?.ok ? (
          <Button className="w-full md:w-auto" onClick={createAll}>
            {BULK_CATEGORY_COPY.create(report.rows.length)}
          </Button>
        ) : (
          <Button
            className="w-full md:w-auto"
            onClick={check}
            pending={
              step === "checking" || step === "uploading" || step === "creating"
            }
          >
            {step === "checking" ? BULK_CATEGORY_COPY.checking : BULK_CATEGORY_COPY.check}
          </Button>
        )}
      </ActionBar>
    </div>
  );
}
