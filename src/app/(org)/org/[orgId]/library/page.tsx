import { requireOrgMember } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";
import { MediaAssetKind, MediaAssetSource } from "@prisma/client";
import { MediaLibraryFilters, type FilterOption } from "@/components/org/media-library-filters";
import { MediaLibraryGrid } from "@/components/org/media-library-grid";
import { MediaLibraryUpload } from "@/components/org/media-library-upload";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { SectionHeader } from "@/components/shared/SectionHeader";

export const metadata = {
  title: "Photos",
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

const KIND_OPTIONS: FilterOption[] = [
  { value: MediaAssetKind.IMAGE, label: "Photos" },
  { value: MediaAssetKind.VIDEO, label: "Videos" },
  { value: MediaAssetKind.VIDEO_EMBED, label: "YouTube links" },
];
const SOURCE_OPTIONS: FilterOption[] = [
  { value: MediaAssetSource.UPLOAD, label: "Uploaded" },
  { value: MediaAssetSource.DERIVED, label: "Cropped or made" },
  { value: MediaAssetSource.EMBED, label: "Video link" },
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
        <SectionHeader as="h1" title="Photos" description="Every photo and video your shop has, where each is used, and what can go." />
        {org && <MediaLibraryUpload orgId={scope.orgId} orgCode={org.code} />}
      </div>

      <MediaLibraryFilters filters={filters} range={{ from: raw.from, to: raw.to }} kinds={KIND_OPTIONS} sources={SOURCE_OPTIONS} />

      <MediaLibraryGrid key={filterQuery} orgId={scope.orgId} initial={{ assets, pagination }} query={filterQuery} />
    </div>
  );
}
