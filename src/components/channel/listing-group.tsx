import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GROUP_STATE, type ListingGroupDTO } from "@server/channels/channel-connection.types";

import { GROUP } from "./family-copy";
import { ROW, axisWord } from "./listing-copy";

interface ListingGroupProps {
  orgId: string;
  title: string;
  count: number;
  axis: string | null;
  label: string;
  /** What the header offers, across tabs (family-merge D6); null for a group of one. */
  group: ListingGroupDTO | null;
  /** The first group explains itself until a family exists (Q22). */
  intro: boolean;
  children: ReactNode;
}

/**
 * An Amazon variation family (Q9): a header naming the item and its axis, its one family action,
 * then its children. A native disclosure, so collapsing needs no client code.
 */
export function ListingGroup({ orgId, title, count, axis, label, group, intro, children }: ListingGroupProps) {
  const href = group ? `/org/${orgId}/channels/family?listings=${group.listingIds.join(",")}` : null;
  const word = axisWord(axis, group?.total ?? count);
  return (
    <li className="border-b last:border-b-0">
      <details open className="group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 py-3">
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-sm font-semibold">{ROW.group(title, count, axis, label)}</span>
            {axis && <span className="text-xs text-muted-foreground">{ROW.groupAxis(axis)}</span>}
            {group?.state === GROUP_STATE.SETTLE && group.settled > 0 && (
              <span className="text-xs text-muted-foreground">{GROUP.someSettled(group.settled, group.total)}</span>
            )}
            {group?.state === GROUP_STATE.MAKE && <span className="text-xs font-medium text-warning">{GROUP.notFamilyYet(group.total)}</span>}
            {group?.state === GROUP_STATE.FAMILY && group.family && <span className="text-xs font-medium text-success">{GROUP.isFamily(group.family.name)}</span>}
            {group?.state === GROUP_STATE.ADD && group.family && (
              <span className="text-xs font-medium text-warning">{GROUP.outside(group.family.name, group.outside)}</span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        {group && href && (
          <div className="flex flex-col gap-2 pb-3">
            {intro && group.state === GROUP_STATE.SETTLE && <p className="text-sm text-muted-foreground">{GROUP.firstTime(label, group.total, word)}</p>}
            {group.state === GROUP_STATE.FAMILY && group.family ? (
              <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
                <Link href={`/org/${orgId}/products/${group.family.productId}`}>{GROUP.seeFamily}</Link>
              </Button>
            ) : (
              <Button asChild variant={group.state === GROUP_STATE.MAKE ? "outline" : "default"} size="sm" className="min-h-10 self-start">
                <Link href={href}>
                  {group.state === GROUP_STATE.MAKE ? GROUP.makeOneFamily : group.state === GROUP_STATE.ADD ? GROUP.addToFamily : GROUP.settleAsFamily}
                </Link>
              </Button>
            )}
          </div>
        )}
        <ul>{children}</ul>
      </details>
    </li>
  );
}
