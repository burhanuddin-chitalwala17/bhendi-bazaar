import { requireOrgMember } from "@/lib/org-auth";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { creditService } from "@server/payouts/credit.service";
import { ShopCreditsButton } from "@/components/payouts/shop-credits-button";
import { parseMediaLibraryFilters } from "@/lib/validation/schemas/media-library.schema";
import { MediaLibraryFilters } from "@/components/org/media-library-filters";
import { MEDIA_KIND_OPTIONS, MEDIA_SOURCE_OPTIONS } from "@/components/org/media-library-copy";
import { MediaLibraryGrid } from "@/components/org/media-library-grid";
import { MediaLibraryUpload } from "@/components/org/media-library-upload";
import { orgsDAL } from "@/data-access-layer/admin/orgs.dal";
import { PageHeader } from "@/components/shared/page-shell";
import { ORG_PAGES_COPY } from "@/components/org/pages-copy";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = {
  title: ORG_PAGE_TITLES.library,
  robots: { index: false, follow: false },
};

type Search = Record<string, string | string[] | undefined>;

/** The filter keys, read by name: the awaited `searchParams` does not enumerate, so a spread sees nothing. */
const FILTER_KEYS = ["tag", "kind", "usage", "source", "from", "to", "productId", "slot", "retired"] as const;

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
  const [{ assets, pagination }, org, credit] = await Promise.all([
    mediaAssetService.listLibrary(scope.orgId, { ...filters, page: 1 }),
    orgsDAL.getOrgSummary(scope.orgId),
    creditService.account(scope.orgId),
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
        <div className="flex flex-wrap gap-2">
          {/* Credit is only spent on photos, so it is kept beside them rather than in the sidebar (ai-images Q34). */}
          {org && <ShopCreditsButton orgId={scope.orgId} shop={org.name} balancePaise={credit.balancePaise} />}
          {org && <MediaLibraryUpload orgId={scope.orgId} orgCode={org.code} />}
        </div>
      </div>

      <MediaLibraryFilters filters={filters} range={{ from: raw.from, to: raw.to }} kinds={MEDIA_KIND_OPTIONS} sources={MEDIA_SOURCE_OPTIONS} />

      <MediaLibraryGrid key={filterQuery} orgId={scope.orgId} orgCode={org?.code ?? null} initial={{ assets, pagination }} query={filterQuery} />
    </div>
  );
}
