"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FixPageDTO, FixRowDTO } from "@server/listing/readiness-fix.types";

import { FIX } from "./readiness-fix-copy";
import { useReadinessFix } from "./useReadinessFix";

/**
 * A fix page (readiness-fix ux.md): the products missing one fact for one channel, each with its photo
 * and a picker that saves as it is used; tick several to answer them at once; Done below, with Undo.
 */
export function ReadinessFix({ orgId, page }: { orgId: string; page: FixPageDTO }) {
  const fix = useReadinessFix(orgId, page);
  const [bulkValue, setBulkValue] = useState("");
  const back = `/org/${orgId}/products`;

  if (fix.rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card bg-info/10 p-4 text-sm">
        <p className="font-semibold">
          {fix.done.length > 0 ? FIX.allDone(fix.done.length, page.factLabel) : FIX.nothingLeft(page.channelLabel, page.factLabel)}
        </p>
        <Button asChild className="min-h-10">
          <Link href={back}>{FIX.back}</Link>
        </Button>
        {fix.done.length > 0 && <DoneList fix={fix} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-4">
      <p className="text-sm text-muted-foreground">{fix.done.length === 0 ? FIX.intro(fix.rows.length) : FIX.toGo(fix.rows.length)}</p>
      {fix.rows.some((r) => r.said) && (
        <label className="flex min-h-10 items-center gap-3 self-start text-sm">
          <Switch checked={fix.onlySaid} onCheckedChange={fix.toggleOnlySaid} aria-label={FIX.onlySaid} />
          {FIX.onlySaid}
        </label>
      )}
      <ul className="flex flex-col divide-y divide-border rounded-card border bg-card md:grid md:grid-cols-2 md:divide-y-0 md:gap-px md:bg-border">
        {fix.visible.map((row) => (
          <li key={row.productId} className="bg-card">
            <Row row={row} page={page} fix={fix} />
          </li>
        ))}
      </ul>
      {fix.hasMore && (
        <Button type="button" variant="outline" size="sm" className="min-h-10 self-start" onClick={fix.showMore}>
          {FIX.showMore}
        </Button>
      )}
      {fix.done.length > 0 && <DoneList fix={fix} />}
      {fix.selected.size > 0 && (
        <div className="sticky bottom-tabbar z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 p-3 backdrop-blur md:bottom-0 md:mx-0 md:flex-row md:items-center md:rounded-card md:border">
          <span className="text-sm font-semibold">{FIX.setSelected(page.factLabel, fix.selected.size)}</span>
          <div className="flex min-w-0 flex-1 gap-2">
            <div className="min-w-0 flex-1">
              <Select aria-label={FIX.setSelected(page.factLabel, fix.selected.size)} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
                <option value="">{FIX.pick}</option>
                {page.options.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              className="min-h-10"
              pending={[...fix.selected].some((id) => fix.saving.has(id))}
              onClick={() => (bulkValue ? void fix.answer([...fix.selected], bulkValue) : toast.info(FIX.pickFirst))}
            >
              {FIX.setButton}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type Fix = ReturnType<typeof useReadinessFix>;

function Row({ row, page, fix }: { row: FixRowDTO; page: FixPageDTO; fix: Fix }) {
  const saving = fix.saving.has(row.productId);
  return (
    <div className="flex items-center gap-3 p-3">
      <Checkbox
        label={FIX.tick}
        aria-label={FIX.select(row.name)}
        className="mt-0"
        checked={fix.selected.has(row.productId)}
        onChange={() => fix.toggle(row.productId)}
      />
      <span className="relative size-18 shrink-0 overflow-hidden rounded-field bg-muted lg:size-24">
        {row.photoUrl && <Image src={row.photoUrl} alt="" fill sizes="(min-width: 1024px) 96px, 72px" className="object-cover" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 break-words text-sm font-medium">{row.name}</p>
        {row.sku && <p className="text-xs tabular-nums text-muted-foreground">{row.sku}</p>}
        {row.said && <p className="text-xs text-muted-foreground">{FIX.says(row.said.label, row.said.value)}</p>}
        <Select
          aria-label={`${page.factLabel}: ${row.name}`}
          value=""
          className={cn("min-h-10", saving && "opacity-70")}
          onChange={(e) => e.target.value && void fix.answer([row.productId], e.target.value)}
        >
          <option value="">{saving ? FIX.saving : FIX.pick}</option>
          {page.options.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </Select>
        {fix.failed.has(row.productId) && <p className="text-xs text-destructive">{FIX.failed}</p>}
      </div>
    </div>
  );
}

function DoneList({ fix }: { fix: Fix }) {
  return (
    <details className="rounded-card border bg-card p-3" open={fix.rows.length === 0}>
      <summary className="min-h-10 cursor-pointer text-sm font-semibold">{FIX.done(fix.done.length)}</summary>
      <ul className="flex flex-col divide-y divide-border">
        {fix.done.map((row) => (
          <li key={row.productId} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 break-words">
              {row.name} · <span className="text-muted-foreground">{fix.label(row.value)}</span>
            </span>
            <Button type="button" variant="link" size="sm" className="h-auto min-h-10 p-0" onClick={() => void fix.undo(row)}>
              {FIX.undo}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
