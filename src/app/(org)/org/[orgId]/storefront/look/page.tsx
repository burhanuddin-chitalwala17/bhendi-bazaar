import Link from "next/link";
import { notFound } from "next/navigation";
import { OrgRole } from "@prisma/client";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { LookPicker } from "@/components/org/look/look-picker";
import { LOOK_COPY } from "@/components/org/look/look-copy";
import { SAMPLE_GOODS_NOTE } from "@/components/storefront/preview/sample-goods";
import { productsDAL } from "@/data-access-layer/products.dal";
import { shareShopFor } from "@/data-access-layer/org/share-shop.dal";
import { requireOrgMember } from "@/lib/org-auth";
import { storefrontLookService } from "@server/catalog/storefront-look.service";
import { NotFoundError } from "@server/shared/domain-error";
import { ROUTES } from "@server/shared/routes";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = { title: ORG_PAGE_TITLES.look, robots: { index: false, follow: false } };

/**
 * The look picker (storefront-themes ux.md; D11, D12): four themes previewed on the shop's own
 * page, published by the owner alone (Q31). A member without that role is told so, not shown a
 * picker whose Publish would only refuse.
 */
export default async function LookPickerPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const back = ROUTES.org.storefront(scope.orgId);

  if (scope.role !== OrgRole.OWNER) {
    return (
      <PageShell width="form">
        <PageHeader help="storefront" title={LOOK_COPY.title} />
        <div role="alert" className="space-y-3 rounded-card border border-border bg-card p-4">
          <p className="text-foreground">{LOOK_COPY.ownerOnly}</p>
          <Button asChild variant="outline" className="min-h-11">
            <Link prefetch={false} href={back}>{LOOK_COPY.back}</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const look = await storefrontLookService.getLook(scope.orgId).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  // ux.md picker, Empty: the frames draw sample goods; this is the way forward from them.
  const { products } = await productsDAL.getPage({ orgId: scope.orgId }, { limit: 1 });
  const share = await shareShopFor({ handle: look.handle, name: look.name, tagline: null, about: null, logoUrl: null }).catch(
    () => null,
  );

  return (
    <PageShell width="wide">
      <PageHeader help="storefront" title={LOOK_COPY.title} />
      {products.length === 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4">
          <p className="text-sm text-foreground">{SAMPLE_GOODS_NOTE}</p>
          <Button asChild className="min-h-11">
            <Link prefetch={false} href={ROUTES.org.newProduct(scope.orgId)}>{LOOK_COPY.addProduct}</Link>
          </Button>
        </div>
      )}
      {/* Not keyed on the version: a refresh after a refusal must keep the open dialog and its words. */}
      <LookPicker look={look} share={share} />
    </PageShell>
  );
}
