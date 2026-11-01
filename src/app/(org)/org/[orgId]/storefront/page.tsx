import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { StorefrontEditor } from "@/components/org/storefront-editor";
import { StorefrontBannersManager } from "@/components/org/storefront-banners-manager";
import { BrandPageStanding } from "@/components/org/brand-page-standing";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { requireOrgMember } from "@/lib/org-auth";
import { storefrontService } from "@server/catalog/storefront.service";

/**
 * Where an org composes its own shop (storefront-branding R1).
 *
 * Membership is established by the [orgId] layout; this page still scopes its own read
 * through the same orgId, because the layout proves who you are and not what a query
 * may return.
 */
export default async function OrgStorefrontPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  await requireOrgMember(orgId);

  const [settings, banners] = await Promise.all([
    storefrontService.getSettings(orgId).catch(() => null),
    storefrontService.listBanners(orgId),
  ]);
  if (!settings) notFound();

  // The shop's own page, read exactly as a buyer's would be, so the panel below reports what
  // is actually served rather than a second opinion assembled from the settings row.
  const page = await storefrontDAL.getBrandPage(settings.handle);

  return (
    <PageShell width="form">
      <PageHeader
        title="Shop page"
        description="Your own page on Bhendi Bazaar, and the link you share."
      />
      <StorefrontBannersManager
        orgId={orgId}
        handle={settings.handle}
        banners={banners}
      />
      {page && <BrandPageStanding page={page} orgId={orgId} />}
      <StorefrontEditor
        orgId={orgId}
        settings={settings}
        oldAddressWorksUntil={
          storefrontService.previewChange(settings.handle).oldAddressWorksUntil
        }
      />
    </PageShell>
  );
}
