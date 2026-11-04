"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { DAY_RANGE_PRESETS, formatDayRange, fromDayKey, toDayKey, type DayRange } from "@/lib/date-range";
import { Icon } from "@/components/ui/icon";

interface DateRangeFieldProps {
  value: DayRange;
  onChange: (range: DayRange) => void;
  /** The form field names the two keys travel under. */
  names?: { from: string; to: string };
}

/**
 * One field for a range of days: the button names the range and the calendar opens against it —
 * a popover on a wide screen, a sheet on a phone
 * ([ADR-0040](../../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)). Two
 * native date inputs took twice the taps and never showed the range together.
 */
export function DateRangeField({ value, onChange, names = { from: "from", to: "to" } }: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const today = new Date();

  /** Opening seeds the draft from what the field carries, so a reopen shows the picked range. */
  const openWith = () => {
    setDraft({ from: fromDayKey(value.from), to: fromDayKey(value.to) });
    setOpen(true);
  };
  const apply = (range: DayRange) => {
    onChange(range);
    setOpen(false);
  };
  const applyDraft = () => {
    if (!draft?.from) return apply({});
    apply({ from: toDayKey(draft.from), to: toDayKey(draft.to ?? draft.from) });
  };

  return (
    <>
      <input type="hidden" name={names.from} value={value.from ?? ""} />
      <input type="hidden" name={names.to} value={value.to ?? ""} />
      <ResponsivePicker
        open={open}
        onOpenChange={(next) => (next ? openWith() : setOpen(false))}
        title="When"
        description="Tap the first day, then the last. A preset picks both."
        className="w-auto max-w-[calc(100vw-2rem)]"
        trigger={
          <Button type="button" variant="outline" className="w-full justify-between font-normal" aria-haspopup="dialog">
            <span className={value.from || value.to ? "" : "text-muted-foreground"}>{formatDayRange(value)}</span>
            <Icon name="calendar" size="sm" className="shrink-0 text-muted-foreground" />
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {DAY_RANGE_PRESETS.map((preset) => (
              <Button key={preset.label} type="button" variant="outline" size="sm" onClick={() => apply(preset.range(today))}>
                {preset.label}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => apply({})}>
              Any time
            </Button>
          </div>
          <Calendar
            mode="range"
            selected={draft}
            onSelect={setDraft}
            numberOfMonths={2}
            defaultMonth={draft?.from ?? new Date(today.getFullYear(), today.getMonth() - 1, 1)}
            disabled={{ after: today }}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {draft?.from
                ? formatDayRange({ from: toDayKey(draft.from), to: draft.to ? toDayKey(draft.to) : undefined })
                : "Nothing picked"}
            </p>
            <Button type="button" onClick={applyDraft} disabled={!draft?.from}>
              {draft?.from && !draft.to ? "Just this day" : "Apply"}
            </Button>
          </div>
        </div>
      </ResponsivePicker>
    </>
  );
}
