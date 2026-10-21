import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { ROW } from "./listing-copy";

interface ListingGroupProps {
  title: string;
  count: number;
  axis: string | null;
  label: string;
  children: ReactNode;
}

/**
 * An Amazon variation family (Q9): a header naming the item and its axis, then its children. A
 * native disclosure, so collapsing needs no client code and works with a keyboard.
 */
export function ListingGroup({ title, count, axis, label, children }: ListingGroupProps) {
  return (
    <li className="border-b last:border-b-0">
      <details open className="group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 py-3">
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-sm font-semibold">{ROW.group(title, count, axis, label)}</span>
            {axis && <span className="text-xs text-muted-foreground">{ROW.groupAxis(axis)}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul>{children}</ul>
      </details>
    </li>
  );
}
