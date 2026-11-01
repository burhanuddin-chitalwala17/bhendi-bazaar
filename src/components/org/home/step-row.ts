import { cn } from "@/lib/utils";

/** A setup step's row, whether it opens a hint or the share sheet. */
export function stepRowClass(isNext: boolean): string {
  return cn(
    "flex h-auto min-h-11 w-full items-center justify-start gap-3 whitespace-normal rounded-card px-2 text-left font-normal hover:bg-muted/60",
    isNext && "bg-muted",
  );
}
