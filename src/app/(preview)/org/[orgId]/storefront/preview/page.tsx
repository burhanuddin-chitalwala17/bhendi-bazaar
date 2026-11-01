import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ThemedShell } from "@/components/storefront/themed/chrome/themed-shell";
import { ThemedSections } from "@/components/storefront/themed/themed-sections";
import { themedPageData } from "@/components/storefront/themed/landing-data";
import { PreviewFrameGuard } from "@/components/storefront/preview/preview-frame-guard";
import { PreviewShop } from "@/components/storefront/preview/preview-shop";
import { PREVIEW_VIEW } from "@/components/storefront/preview/preview-href";
import { SAMPLE_GOODS_NOTE, sampleGoods, withSampleGoods } from "@/components/storefront/preview/sample-goods";
import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { requireOrgMember } from "@/lib/org-auth";
import { storefrontLookService } from "@server/catalog/storefront-look.service";
import { readStorefrontLook } from "@server/catalog/storefront-themes";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * A shop in the look its owner is trying (storefront-themes D12, Q32): the same sections a buyer's
 * page renders, for keys the picker asks for, without portal chrome, framed only by our own
 * pages (`SELF_FRAMED_SOURCE`). Members only; never indexed.
 */
export default async function LookPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ theme?: string; palette?: string; view?: string }>;
}) {
  const [{ orgId }, query] = await Promise.all([params, searchParams]);
  const scope = await requireOrgMember(orgId).catch(() => null);
  const look = readStorefrontLook(query.theme, query.palette);
  if (!scope || !look) notFound();

  const { handle } = await storefrontLookService.getLook(scope.orgId);
  const page = await storefrontDAL.getStorefrontPreview(handle, look);
  if (!page) notFound();
  const sample = page.productCount === 0;
  const data = withSampleGoods(themedPageData(page), page);
  const shopView = query.view === PREVIEW_VIEW.SHOP;
  const goods = shopView && !sample ? (await productsDAL.getPage({ orgId: page.id })).products : [];

  return (
    <ThemedShell shop={{ handle, name: page.name, logoUrl: page.logoUrl, themeKey: look.theme, paletteKey: look.palette }}>
      <PreviewFrameGuard />
      <div data-storefront-preview="">
        {sample && (
          <p className="bg-muted px-gutter py-2 text-center font-label text-tag text-muted-foreground">{SAMPLE_GOODS_NOTE}</p>
        )}
        {shopView ? (
          <PreviewShop
            theme={look.theme}
            handle={handle}
            name={page.name}
            total={data.productCount}
            products={sample ? sampleGoods(page) : goods}
          />
        ) : (
          <ThemedSections theme={look.theme} page={data} preview />
        )}
      </div>
    </ThemedShell>
  );
}
