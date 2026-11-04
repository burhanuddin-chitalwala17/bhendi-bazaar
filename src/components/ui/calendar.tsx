"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/**
 * The one calendar (ADR-0031), react-day-picker dressed in our tokens: its stylesheet is not
 * loaded, every class comes from here, so a theme change reaches it like any other control
 * (ADR-0022). Day cells are 40px, the touch floor (ADR-0015).
 */
export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={cn("p-1", className)}
      classNames={{
        root: "relative",
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-2",
        month_caption: "flex h-10 items-center justify-center px-10",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-1 top-1 flex justify-between",
        button_previous:
          "inline-flex size-10 items-center justify-center rounded-field border border-input text-foreground hover:bg-muted disabled:opacity-40",
        button_next:
          "inline-flex size-10 items-center justify-center rounded-field border border-input text-foreground hover:bg-muted disabled:opacity-40",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-10 text-center text-2xs font-normal uppercase tracking-label text-muted-foreground",
        week: "mt-1 flex",
        day: "size-10 p-0 text-center text-sm",
        day_button: "size-10 rounded-field hover:bg-muted",
        selected: "bg-primary text-primary-foreground hover:bg-primary",
        range_start: "rounded-field",
        range_middle: "rounded-none bg-primary/15 text-foreground hover:bg-primary/25",
        range_end: "rounded-field",
        today: "font-semibold underline underline-offset-4",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground/40 hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <Icon name="previous" size="sm" /> : <Icon name="next" size="sm" />,
      }}
      {...props}
    />
  );
}
