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
import { ADMIN_MEDIA_COPY } from "./media-copy";
import { ADMIN_SHELL_COPY } from "../admin-copy";
import { ROUTES } from "@server/shared/routes";

export const metadata = {
  title: ADMIN_MEDIA_COPY.metaTitle,
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

/** Read by name: the awaited `searchParams` does not enumerate, so a spread sees nothing. */
const FILTER_KEYS = ["kind", "usage", "source", "from", "to", "retired", "page"] as const;

/** `all` is every library at once; `platform` is the collection belonging to nobody (spec R12). */
const ALL = "all";
const PLATFORM = "platform";

const KIND_LABEL: Record<string, string> = {
  [MediaAssetKind.IMAGE]: ADMIN_MEDIA_COPY.kindPhoto,
  [MediaAssetKind.VIDEO]: ADMIN_MEDIA_COPY.kindVideo,
  [MediaAssetKind.VIDEO_EMBED]: ADMIN_MEDIA_COPY.kindVideoLink,
};

const SOURCE_LABEL: Record<string, string> = {
  [MediaAssetSource.UPLOAD]: ADMIN_MEDIA_COPY.sourceUpload,
  [MediaAssetSource.DERIVED]: ADMIN_MEDIA_COPY.sourceDerived,
  [MediaAssetSource.EMBED]: ADMIN_MEDIA_COPY.sourceEmbed,
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
    return qs ? `${ROUTES.admin.media}?${qs}` : ROUTES.admin.media;
  };

  /** Choosing a library starts its listing over, so the page goes with it. */
  const ownerLink = (value: string | undefined) => linkTo({ owner: value, page: undefined });

  return (
    <PageShell>
      <PageHeader
        title={ADMIN_MEDIA_COPY.title}
        description={ADMIN_MEDIA_COPY.description}
      />

      <nav aria-label={ADMIN_MEDIA_COPY.whose} className="flex flex-wrap gap-2">
        <OwnerChip href={ownerLink(undefined)} label={ADMIN_MEDIA_COPY.everyone} active={!owner || owner === ALL} />
        <OwnerChip href={ownerLink(PLATFORM)} label={ADMIN_MEDIA_COPY.platformOwn} active={owner === PLATFORM} />
        {orgs.map((org) => (
          <OwnerChip key={org.id} href={ownerLink(org.id)} label={org.name} active={owner === org.id} />
        ))}
      </nav>

      <p className="text-small text-muted-foreground tabular-nums">
        {ADMIN_MEDIA_COPY.count(pagination.total)}
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
                <StatusBadge tone="warning">{ADMIN_MEDIA_COPY.retired}</StatusBadge>
              )}
            </div>

            <dl className="space-y-0.5 text-small text-muted-foreground">
              <div>
                <dt className="sr-only">{ADMIN_MEDIA_COPY.whoseTerm}</dt>
                <dd>{asset.orgId ? (orgName.get(asset.orgId) ?? ADMIN_MEDIA_COPY.anOrg) : ADMIN_MEDIA_COPY.platform}</dd>
              </div>
              <div>
                <dt className="sr-only">{ADMIN_MEDIA_COPY.added}</dt>
                <dd>{formatDay(asset.createdAt)}</dd>
              </div>
              {asset.retiredReason && (
                <div>
                  <dt className="sr-only">{ADMIN_MEDIA_COPY.whyDown}</dt>
                  <dd className="text-foreground">{ADMIN_MEDIA_COPY.takenDown(asset.retiredReason)}</dd>
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
        <p className="text-small text-muted-foreground">{ADMIN_MEDIA_COPY.nothing}</p>
      )}

      {pagination.totalPages > 1 && (
        <nav aria-label={ADMIN_SHELL_COPY.pages} className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" disabled={pagination.page <= 1}>
            <Link href={linkTo({ page: String(Math.max(1, pagination.page - 1)) })}>{ADMIN_SHELL_COPY.previous}</Link>
          </Button>
          <span className="text-small text-muted-foreground tabular-nums">
            {ADMIN_MEDIA_COPY.page(pagination.page, pagination.totalPages)}
          </span>
          <Button asChild variant="ghost" size="sm" disabled={pagination.page >= pagination.totalPages}>
            <Link href={linkTo({ page: String(Math.min(pagination.totalPages, pagination.page + 1)) })}>
              {ADMIN_SHELL_COPY.next}
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
