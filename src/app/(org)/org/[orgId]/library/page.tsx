import { requireOrgMember } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";
import { MediaAssetKind, MediaAssetSource } from "@prisma/client";
import { MediaLibraryFilters, type FilterOption } from "@/components/org/media-library-filters";
import { MediaLibraryGrid } from "@/components/org/media-library-grid";
import { MediaLibraryUpload } from "@/components/org/media-library-upload";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { PageHeader } from "@/components/shared/page-shell";
import { ORG_PAGES_COPY } from "@/components/org/pages-copy";
import { LIBRARY_FILTER_COPY, ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = {
  title: ORG_PAGE_TITLES.library,
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

const KIND_OPTIONS: FilterOption[] = [
  { value: MediaAssetKind.IMAGE, label: LIBRARY_FILTER_COPY.photos },
  { value: MediaAssetKind.VIDEO, label: LIBRARY_FILTER_COPY.videos },
  { value: MediaAssetKind.VIDEO_EMBED, label: LIBRARY_FILTER_COPY.youtubeLinks },
];
const SOURCE_OPTIONS: FilterOption[] = [
  { value: MediaAssetSource.UPLOAD, label: LIBRARY_FILTER_COPY.uploaded },
  { value: MediaAssetSource.DERIVED, label: LIBRARY_FILTER_COPY.croppedOrMade },
  { value: MediaAssetSource.EMBED, label: LIBRARY_FILTER_COPY.videoLink },
];

/** The filter keys, read by name: the awaited `searchParams` does not enumerate, so a spread sees nothing. */
const FILTER_KEYS = ["kind", "usage", "source", "from", "to", "productId", "slot", "retired"] as const;

/** The org's images and videos in one place, filtered from the URL (media-library spec R6). */
export default async function OrgLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Search>;
}) {
  const { orgId } = await params;
  const search = await searchParams;
  const raw: Record<string, string | undefined> = {};
  for (const key of FILTER_KEYS) {
    const value = search[key];
    raw[key] = Array.isArray(value) ? value[0] : value;
  }
  const scope = await requireOrgMember(orgId);
  const filters = parseMediaLibraryFilters(raw);
  const [{ assets, pagination }, org] = await Promise.all([
    mediaAssetService.listLibrary(scope.orgId, { ...filters, page: 1 }),
    orgsDAL.getOrgSummary(scope.orgId),
  ]);

  // The filters, minus the page, are what the grid asks for more with — and its key, so a
  // filter change starts the list over instead of appending under the old one.
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) if (raw[key]) query.set(key, raw[key]);
  const filterQuery = query.toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader help="library" title={ORG_PAGES_COPY.libraryTitle} description={ORG_PAGES_COPY.libraryDescription} />
        {org && <MediaLibraryUpload orgId={scope.orgId} orgCode={org.code} />}
      </div>

      <MediaLibraryFilters filters={filters} range={{ from: raw.from, to: raw.to }} kinds={KIND_OPTIONS} sources={SOURCE_OPTIONS} />

      <MediaLibraryGrid key={filterQuery} orgId={scope.orgId} initial={{ assets, pagination }} query={filterQuery} />
    </div>
  );
}
