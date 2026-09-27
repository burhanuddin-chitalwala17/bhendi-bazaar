"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DAY_RANGE_PRESETS, formatDayRange, fromDayKey, toDayKey, type DayRange } from "@/lib/date-range";

interface DateRangeFieldProps {
  value: DayRange;
  onChange: (range: DayRange) => void;
  /** The form field names the two keys travel under. */
  names?: { from: string; to: string };
}

/**
 * One field for a range of days: a button that names the range, a sheet with a two-month
 * calendar where the picked range is highlighted, and the presets people reach for. Two native
 * date inputs took twice the taps and never showed the range together.
 */
export function DateRangeField({ value, onChange, names = { from: "from", to: "to" } }: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const today = new Date();

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
      <Button type="button" variant="outline" onClick={openWith} className="w-full justify-between font-normal" aria-haspopup="dialog">
        <span className={value.from || value.to ? "" : "text-muted-foreground"}>{formatDayRange(value)}</span>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : setOpen(false))}>
        <SheetContent side="adaptive" className="md:max-w-2xl">
          <SheetTitle>When</SheetTitle>
          <SheetDescription>Tap the first day, then the last. A preset picks both.</SheetDescription>
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
            <p className="text-sm text-muted-foreground">{draft?.from ? formatDayRange({ from: toDayKey(draft.from), to: draft.to ? toDayKey(draft.to) : undefined }) : "Nothing picked"}</p>
            <Button type="button" onClick={applyDraft} disabled={!draft?.from}>
              {draft?.from && !draft.to ? "Just this day" : "Apply"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
