"use client";

/**
 * The bulk-upload wizard, in four steps (own-store/bulk-sheet Q16): Get the sheet · Fill it ·
 * Upload · Check and create. The last two are bulk-catalog-upload R1–R3: sheet + images in, one
 * validation report, then upload-and-create. Images go browser → object store directly
 * (D10); nothing is created until the sheet validated clean.
 *
 * Mobile-first: both pickers are native file inputs (the photo picker on a
 * phone), the report and match list are single-column, and the primary action
 * docks above the tab bar (ADR-0015/0016).
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { SheetChoicesDTO } from "@server/catalog/bulk/bulk-sheet.service";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ActionBar } from "@/components/shared/action-bar";
import { matchingPaths } from "@server/catalog/bulk/image-match";
import { bulkPhotoPath, imagesOnly, sanitizePath } from "./files";
import { bulkImportApiClient, productBulkBase } from "./bulkImportApiClient";
import { TeamUploadBanner } from "./TeamUploadBanner";
import { useBulkImport } from "./useBulkImport";
import { useMarkedSheet } from "./useMarkedSheet";
import { GetTheSheet } from "./GetTheSheet";
import { CheckReport } from "./CheckReport";
import { CHECK_COPY, rowsWithProblems } from "./check-copy";
import { SHEET_AGE_COPY, TEAM_BULK_COPY } from "@server/catalog/bulk/sheet-copy";
import { teamReasonField } from "@/lib/validation/schemas/product.schema";
import { downscaleImage, storedPathFor } from "@/lib/image/downscale";
import { uploadDirect } from "@/lib/image/upload-direct";
import { orgUploadEndpoints, teamUploadEndpoints } from "@/lib/image/upload-endpoints";

const STEPS = ["Get the sheet", "Fill it", "Upload", "Check and create"] as const;
type Stage = "get" | "fill" | "upload";

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {STEPS.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined} className={index === current ? "font-semibold text-foreground" : ""}>
          {index + 1} · {label}
        </li>
      ))}
    </ol>
  );
}

/** `team` is the Bhendi Bazaar team uploading for this shop, through the admin routes (own-store/bulk-sheet R9). */
export function BulkProductWizard({
  orgId,
  choices,
  team,
}: {
  orgId: string;
  choices: SheetChoicesDTO;
  team?: { shopName: string };
}) {
  const base = productBulkBase(orgId, !!team);
  const endpoints = team ? teamUploadEndpoints(orgId) : orgUploadEndpoints(orgId);
  const [stage, setStage] = useState<Stage>("get");
  const { step, sheet, setSheet, images, setImages, report, created, updated, providedPaths, check, run, reset } = useBulkImport(
    (sheet, filenames) => bulkImportApiClient.validateProducts(base, sheet, filenames),
  );
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const downloadMarked = useMarkedSheet(base, sheet, providedPaths);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  // A stale sheet is accepted once the shop says to go on with it (own-store Q10); a new check asks again.
  const [continued, setContinued] = useState(false);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const checkSheet = () => {
    // Never disabled (owner rule): a tap while busy says what is happening instead.
    if (step === "checking" || step === "uploading" || step === "creating") {
      toast(step === "checking" ? CHECK_COPY.reading : `Uploading photos ${progress.done}/${progress.total}… keep this page open`);
      return;
    }
    setContinued(false);
    return check();
  };
  // A refused or stale report belongs to the file it read; a new file or a fresh download clears it.
  const startOver = () => {
    reset();
    setContinued(false);
  };
  const getFreshSheet = () => {
    startOver();
    setStage("get");
  };
  const sheetAge = step === "report" ? report?.sheet : undefined;
  const waitingOnAge = !!sheetAge && (!!sheetAge.refusedColumn || (sheetAge.stale && !continued));
  // Rows with problems come back in the shop's own file (R6); a problem with the file itself does not.
  const rowProblems = step === "report" && !!report && !report.ok && rowsWithProblems(report.errors) > 0;

  const createAll = async () => {
    if (!report?.ok || !report.orgCode) return;
    // The reason is the server's rule, asked before any photo goes up (ux.md, Admin: Terminal error).
    const why = team ? teamReasonField.safeParse(reason) : null;
    if (why && !why.success) {
      setReasonError(why.error.issues[0]?.message ?? null);
      return;
    }
    const orgCode = report.orgCode;
    const needed = [...new Set(report.rows.flatMap(({ row }) => row.images))];
    setProgress({ done: 0, total: needed.length });
    await run(async ({ filesByPath, providedPaths, creating }) => {
      // A small queue, not a 3000-promise stampede: a phone's radio and the
      // token route both prefer bounded concurrency.
      const urls = new Map<string, string>();
      const queue = [...needed];
      let done = 0;
      const worker = async () => {
        for (
          let reference = queue.shift();
          reference;
          reference = queue.shift()
        ) {
          // Validation already proved each reference names exactly one file.
          const [path] = matchingPaths(reference, providedPaths);
          const file = path ? filesByPath.get(path) : undefined;
          if (!file) throw new Error(`Missing file "${reference}"`);
          // Downscaled here because these bytes never pass through a function, so the
          // server's normalisation cannot reach them (ADR-0026).
          const downscaled = await downscaleImage(file);
          const { url } = await uploadDirect(
            bulkPhotoPath(orgCode, storedPathFor(sanitizePath(path), downscaled)),
            downscaled,
            endpoints,
          );
          urls.set(reference, url);
          done += 1;
          setProgress({ done, total: needed.length });
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));

      creating();
      const rows = report.rows.map(({ row, rowNumber, tab }) => ({
        ...row,
        rowNumber,
        tab,
        imageUrls: Object.fromEntries(
          row.images.map((name) => [name, urls.get(name)!]),
        ),
      }));
      return bulkImportApiClient.createProducts(
        base,
        rows,
        why?.success ? { reason: why.data, fileName: sheet?.name ?? "" } : undefined,
      );
    });
  };

  // Above every step, so the team never loses sight of whose shop this is (ux.md, Admin: First use).
  const banner = team && (
    <TeamUploadBanner
      shopName={team.shopName}
      reason={reason}
      error={reasonError}
      onReason={(value) => {
        setReason(value);
        setReasonError(null);
      }}
    />
  );

  if (stage === "get") {
    return (
      <div className="space-y-4">
        {banner}
        <Steps current={0} />
        <GetTheSheet orgId={orgId} base={base} choices={choices} onDownloaded={() => setStage("fill")} />
        <Button variant="link" className="px-0" onClick={() => setStage("upload")}>
          I already have a filled sheet
        </Button>
      </div>
    );
  }

  if (stage === "fill") {
    return (
      <div className="space-y-4">
        {banner}
        <Steps current={1} />
        <section className="space-y-3 rounded-card border border-border bg-card p-4">
          <p className="text-sm">Fill the sheet on your laptop or phone, then come back.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setStage("upload")}>I&apos;ve filled it</Button>
            <Button variant="outline" onClick={() => setStage("get")}>
              Download sheet
            </Button>
          </div>
        </section>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        {/* Both numbers, because they are not the same event: a wrong create leaves a
            product to archive, and a wrong update has overwritten something. */}
        <p className="text-lg font-semibold">
          {team ? TEAM_BULK_COPY.done(team.shopName, created, updated) : CHECK_COPY.done(created + updated, created, updated)}
        </p>
        <Button asChild>
          {team ? (
            <a href={`/admin/orgs/${orgId}?tab=products`}>{TEAM_BULK_COPY.viewProducts(team.shopName)}</a>
          ) : (
            <a href={`/org/${orgId}/products`}>View products</a>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {banner}
      <Steps current={step === "pick" || step === "checking" ? 2 : 3} />
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Your filled sheet (.xlsx or .csv)</p>
          <Button variant="link" size="sm" className="px-0" onClick={getFreshSheet}>
            Download a fresh sheet
          </Button>
        </div>
        <input
          ref={sheetInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          onChange={(e) => {
            setSheet(e.target.files?.[0] ?? null);
            startOver();
          }}
        />

        <div className="space-y-1 pt-2">
          <p className="text-sm font-medium">Your photos — a folder keeps each product&apos;s photos apart</p>
          <p className="text-xs text-muted-foreground">
            Two products can both have a <code>front.jpg</code> — write the
            folder in the sheet as <code>emerald-abaya/front.jpg</code>. A flat selection works too
            when every filename is different.
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
            {providedPaths.some((path) => path.includes("/"))
              ? ", with folders"
              : ""}
          </p>
        )}
      </section>

      {step === "report" && report && (
        <CheckReport
          report={report}
          continued={continued}
          onContinue={() => setContinued(true)}
          onFresh={getFreshSheet}
          onPickFile={() => sheetInputRef.current?.click()}
        />
      )}

      {(step === "uploading" || step === "creating") && (
        <section className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <Spinner />
          {step === "uploading"
            ? `Uploading photos… ${progress.done}/${progress.total}`
            : "Creating products…"}
        </section>
      )}

      <ActionBar className="-mx-4 md:mx-0">
        {waitingOnAge && sheetAge?.refusedColumn ? (
          <Button className="w-full md:w-auto" onClick={getFreshSheet}>
            {SHEET_AGE_COPY.fresh}
          </Button>
        ) : waitingOnAge ? (
          <Button className="w-full md:w-auto" onClick={() => setContinued(true)}>
            {SHEET_AGE_COPY.continue}
          </Button>
        ) : rowProblems ? (
          <>
            <Button variant="outline" className="flex-1 md:flex-none" onClick={checkSheet}>
              Check the sheet
            </Button>
            <Button className="flex-1 md:flex-none" onClick={downloadMarked}>
              {CHECK_COPY.downloadMarked}
            </Button>
          </>
        ) : step === "report" && report?.ok ? (
          <Button className="w-full md:w-auto" onClick={createAll}>
            {CHECK_COPY.createAction(report.plan.creates, report.plan.updates)}
          </Button>
        ) : (
          <Button
            className="w-full md:w-auto"
            onClick={checkSheet}
            pending={step === "checking"}
          >
            {step === "checking" ? CHECK_COPY.reading : "Check the sheet"}
          </Button>
        )}
      </ActionBar>
    </div>
  );
}
