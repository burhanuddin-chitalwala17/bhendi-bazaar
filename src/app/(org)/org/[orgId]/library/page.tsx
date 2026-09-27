import { requireOrgMember } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";
import { MediaLibraryFilters } from "@/components/org/media-library-filters";
import { MediaLibraryGrid } from "@/components/org/media-library-grid";

export const metadata = {
  title: "Library",
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

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
  const scope = await requireOrgMember(orgId);
  const filters = parseMediaLibraryFilters(search);
  const { assets, pagination } = await mediaAssetService.listLibrary(scope.orgId, { ...filters, page: 1 });

  // The filters, minus the page, are what the grid asks for more with — and its key, so a
  // filter change starts the list over instead of appending under the old one.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first && key !== "page") query.set(key, first);
  }
  const filterQuery = query.toString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Library</h1>
        <p className="text-muted-foreground">
          Every photo and video your shop has, where each is used, and what can go.
        </p>
      </div>

      <MediaLibraryFilters filters={filters} />

      <MediaLibraryGrid key={filterQuery} orgId={scope.orgId} initial={{ assets, pagination }} query={filterQuery} />
    </div>
  );
}
