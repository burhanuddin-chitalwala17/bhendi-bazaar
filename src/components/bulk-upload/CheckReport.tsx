"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { SHEET_AGE_COPY } from "@server/catalog/bulk/sheet-copy";
import type { ProductBulkReport } from "./bulkImportApiClient";
import { CHECK_COPY } from "./check-copy";
import { useProblemList } from "./useProblemList";
import { BULK_IMPORT_COPY } from "./bulk-copy";

/**
 * What the check found (own-store/bulk-sheet ux.md, Upload and Check and create): the sheet's age
 * first, then its problems grouped by row, or the clean summary with its counts (R4, R7, R8). The
 * marked-file download is the wizard's docked action (R6).
 */
export function CheckReport({
  report,
  continued,
  onContinue,
  onFresh,
  onPickFile,
}: {
  report: ProductBulkReport;
  /** The shop chose to go on with a stale sheet. */
  continued: boolean;
  onContinue: () => void;
  onFresh: () => void;
  /** A problem with the file itself (row 0) is answered by another file (ux.md, Terminal error). */
  onPickFile: () => void;
}) {
  const { sheet } = report;
  if (sheet.refusedColumn) {
    return (
      <section role="alert" className="space-y-3 rounded-card border border-destructive/40 bg-card p-4">
        <p className="text-sm font-semibold text-destructive">{SHEET_AGE_COPY.tooOld(sheet.refusedColumn)}</p>
        <Button onClick={onFresh}>{SHEET_AGE_COPY.fresh}</Button>
      </section>
    );
  }
  if (sheet.stale && !continued) {
    const date = sheet.madeOn ? formatDate(sheet.madeOn, { day: "numeric", month: "short" }) : null;
    return (
      <section className="space-y-3 rounded-card border border-warning/40 bg-warning/10 p-4">
        <p className="text-sm">{SHEET_AGE_COPY.stale(date)}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onContinue}>{SHEET_AGE_COPY.continue}</Button>
          <Button variant="outline" onClick={onFresh}>
            {SHEET_AGE_COPY.fresh}
          </Button>
        </div>
      </section>
    );
  }
  return report.ok ? <CleanSummary report={report} /> : <Problems report={report} onPickFile={onPickFile} />;
}

function Problems({ report, onPickFile }: { report: ProductBulkReport; onPickFile: () => void }) {
  const list = useProblemList(report.errors);
  return (
    <section className="space-y-3 rounded-card border border-destructive/40 bg-card p-4">
      <p className="text-sm font-semibold text-destructive">{CHECK_COPY.problems(report.errors.length, list.rowCount)}</p>
      {list.rowCount > 0 && <p className="text-sm text-muted-foreground">{CHECK_COPY.fixAndReupload}</p>}
      {list.columns.length > 1 && (
        <Select aria-label={BULK_IMPORT_COPY.filterByColumn} value={list.column} onChange={(event) => list.setColumn(event.target.value)}>
          <option value="">{CHECK_COPY.allColumns}</option>
          {list.columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </Select>
      )}
      <ul className="space-y-3 text-sm">
        {list.groups.map((group) => (
          <li key={group.label} className="space-y-1">
            <p className="font-medium">{group.label}</p>
            <ul className="space-y-1">
              {group.problems.map((problem, index) => (
                <li key={index} className="grid gap-x-3 md:grid-cols-[10rem_1fr]">
                  <span className="text-xs text-muted-foreground md:text-sm">{problem.column ?? ""}</span>
                  <span>{problem.message}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {list.fileProblem && (
        <Button variant="outline" onClick={onPickFile}>
          {CHECK_COPY.pickAnother}
        </Button>
      )}
      {list.hidden > 0 && (
        <Button variant="link" className="px-0" onClick={list.showAll}>
          {CHECK_COPY.showAll(list.total)}
        </Button>
      )}
    </section>
  );
}

function CleanSummary({ report }: { report: ProductBulkReport }) {
  return (
    <section className="space-y-2 rounded-card border border-border bg-card p-4">
      <p className="text-sm font-semibold">
        {CHECK_COPY.clean(report.rows.length, report.plan.creates, report.plan.updates)}
      </p>
      <ul className="max-h-overlay space-y-1 overflow-y-auto text-sm">
        {report.rows.map(({ row }, index) => (
          <li key={index} className="flex items-center justify-between gap-2">
            <span className="truncate">{row.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.images.length} photo{row.images.length === 1 ? "" : "s"}
              {row.videoRef ? " + video" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
