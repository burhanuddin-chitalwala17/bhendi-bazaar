import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { TEAM_EDIT_COPY } from "./team-edit-copy";

/** "Edited by Bhendi Bazaar team · 30 Oct" while the team's mark is on the product (product-form R12, Q14). */
export function TeamEditBadge({ at, historyHref }: { at: Date | string; historyHref?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Badge variant="secondary" className="whitespace-normal text-left">
        {TEAM_EDIT_COPY.badge(at)}
      </Badge>
      {historyHref && (
        <Link href={historyHref} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
          {TEAM_EDIT_COPY.seeWhatChanged}
        </Link>
      )}
    </div>
  );
}
