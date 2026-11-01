import type { ListingScreenDTO } from "@server/channels/platform-listing.types";

import { FIELD_NAME, PUBLISH } from "./platform-listing-copy";

/**
 * The top of a listing with problems (marketplace-publish Q6, ux.md "Needs attention"): how many, each
 * pinned one as a link to its field, and the ones the marketplace named no field for, in full.
 */
export function ListingIssuesBanner({ screen }: { screen: ListingScreenDTO }) {
  if (screen.issues.length === 0 && !screen.showing) return null;
  const pinned = screen.issues.filter((i) => i.field !== null);
  const general = screen.issues.filter((i) => i.field === null);
  return (
    <section className="flex flex-col gap-2 rounded-card bg-destructive/10 p-3 text-sm">
      {screen.issues.length > 0 && <p className="font-semibold text-destructive">{PUBLISH.general(screen.issues.length)}</p>}
      {pinned.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {pinned.map((issue) => (
            <li key={`${issue.field}-${issue.code}`}>
              <a className="underline underline-offset-4" href={`#field-${issue.field}`}>
                {FIELD_NAME[issue.field as keyof typeof FIELD_NAME]}
              </a>
            </li>
          ))}
        </ul>
      )}
      {general.map((issue) => (
        <p key={`${issue.code}-${issue.message}`}>
          <span className="font-semibold">{PUBLISH.says(screen.label)}</span> {issue.message}
        </p>
      ))}
      {screen.showing && (screen.showing.title || screen.showing.mainImageUrl) && (
        <p className="text-muted-foreground">{PUBLISH.showingOther(screen.label, screen.showing.title ?? "another photo")}</p>
      )}
    </section>
  );
}
