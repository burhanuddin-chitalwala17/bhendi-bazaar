import Image from "next/image";
import Link from "next/link";
import { MediaAssetKind, MediaAssetSource, MediaAssetState } from "@prisma/client";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { Button } from "@/components/ui/button";
import { MediaTakedown } from "@/components/org/media-takedown";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { previewUrlFor } from "@server/catalog/media-library.types";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { formatDay } from "@/lib/format";

export const metadata = {
  title: "Media",
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

/** Read by name: the awaited `searchParams` does not enumerate, so a spread sees nothing. */
const FILTER_KEYS = ["kind", "usage", "source", "from", "to", "retired", "page"] as const;

/** `all` is every library at once; `platform` is the collection belonging to nobody (spec R12). */
const ALL = "all";
const PLATFORM = "platform";

const KIND_LABEL: Record<string, string> = {
  [MediaAssetKind.IMAGE]: "Photo",
  [MediaAssetKind.VIDEO]: "Video",
  [MediaAssetKind.VIDEO_EMBED]: "Video link",
};

const SOURCE_LABEL: Record<string, string> = {
  [MediaAssetSource.UPLOAD]: "Uploaded",
  [MediaAssetSource.DERIVED]: "Made from another",
  [MediaAssetSource.EMBED]: "Video link",
};

function scopeFrom(owner: string | undefined): string | null | undefined {
  if (!owner || owner === ALL) return undefined;
  return owner === PLATFORM ? null : owner;
}

/**
 * Every organisation's library, read-only (media-library spec R12, trd D10).
 *
 * The listing is the org's own query with the org filter widened, so the two screens cannot
 * come to disagree about what a library holds. Rendered on the server and paged by link:
 * there is one browser-callable route behind this screen and it is the takedown, because a
 * takedown is the only thing here that writes.
 */
export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePlatformAdmin();
  const search = await searchParams;
  const raw: Record<string, string | undefined> = {};
  for (const key of FILTER_KEYS) {
    const value = search[key];
    raw[key] = Array.isArray(value) ? value[0] : value;
  }
  const owner = Array.isArray(search.owner) ? search.owner[0] : search.owner;

  const filters = parseMediaLibraryFilters(raw);
  const [{ assets, pagination }, orgs] = await Promise.all([
    mediaAssetService.listAnywhere(scopeFrom(owner), filters),
    orgsDAL.getOrgs(),
  ]);
  const orgName = new Map(orgs.map((org) => [org.id, org.name]));

  /** The current filters with one thing changed. `undefined` drops a key rather than blanking it. */
  const linkTo = (changes: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const key of FILTER_KEYS) if (raw[key]) query.set(key, raw[key]);
    if (owner) query.set("owner", owner);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) query.delete(key);
      else query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/admin/media?${qs}` : "/admin/media";
  };

  /** Choosing a library starts its listing over, so the page goes with it. */
  const ownerLink = (value: string | undefined) => linkTo({ owner: value, page: undefined });

  return (
    <PageShell>
      <PageHeader
        title="Media"
        description="Every shop's photos and videos, read-only. The one action here is taking an image down."
      />

      <nav aria-label="Whose library" className="flex flex-wrap gap-2">
        <OwnerChip href={ownerLink(undefined)} label="Everyone" active={!owner || owner === ALL} />
        <OwnerChip href={ownerLink(PLATFORM)} label="The platform's own" active={owner === PLATFORM} />
        {orgs.map((org) => (
          <OwnerChip key={org.id} href={ownerLink(org.id)} label={org.name} active={owner === org.id} />
        ))}
      </nav>

      <p className="text-small text-muted-foreground tabular-nums">
        {pagination.total} {pagination.total === 1 ? "item" : "items"}
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => {
          const preview = previewUrlFor(asset);
          return (
          <li key={asset.id} className="flex flex-col gap-2 rounded-card border border-border/60 p-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-field bg-muted">
              {preview && (
                <Image
                  src={preview}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20rem, (min-width: 640px) 45vw, 90vw"
                  className="object-cover"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              <StatusBadge>{KIND_LABEL[asset.kind] ?? asset.kind}</StatusBadge>
              <StatusBadge>{SOURCE_LABEL[asset.source] ?? asset.source}</StatusBadge>
              {asset.state === MediaAssetState.RETIRED && (
                <StatusBadge tone="warning">Retired</StatusBadge>
              )}
            </div>

            <dl className="space-y-0.5 text-small text-muted-foreground">
              <div>
                <dt className="sr-only">Whose</dt>
                <dd>{asset.orgId ? (orgName.get(asset.orgId) ?? "An organisation") : "The platform"}</dd>
              </div>
              <div>
                <dt className="sr-only">Added</dt>
                <dd>{formatDay(asset.createdAt)}</dd>
              </div>
              {asset.retiredReason && (
                <div>
                  <dt className="sr-only">Why it came down</dt>
                  <dd className="text-foreground">Taken down: {asset.retiredReason}</dd>
                </div>
              )}
            </dl>

            <div className="mt-auto">
              <MediaTakedown
                assetId={asset.id}
                previewUrl={preview}
                alreadyRetired={asset.state === MediaAssetState.RETIRED}
              />
            </div>
          </li>
          );
        })}
      </ul>

      {assets.length === 0 && (
        <p className="text-small text-muted-foreground">Nothing matches. Try another shop or clear the filters.</p>
      )}

      {pagination.totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" disabled={pagination.page <= 1}>
            <Link href={linkTo({ page: String(Math.max(1, pagination.page - 1)) })}>Previous</Link>
          </Button>
          <span className="text-small text-muted-foreground tabular-nums">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button asChild variant="ghost" size="sm" disabled={pagination.page >= pagination.totalPages}>
            <Link href={linkTo({ page: String(Math.min(pagination.totalPages, pagination.page + 1)) })}>
              Next
            </Link>
          </Button>
        </nav>
      )}
    </PageShell>
  );
}

function OwnerChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Button asChild variant={active ? "default" : "ghost"} size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
