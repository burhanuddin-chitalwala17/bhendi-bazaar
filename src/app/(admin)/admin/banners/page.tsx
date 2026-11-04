/** The storefront hero, in the order a shopper sees it. */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BannerList } from "@/components/banners/BannerList";
import { BANNER_PAGE_COPY } from "@/components/banners/banner-copy";
import { ROUTES } from "@server/shared/routes";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { bannerService } from "@server/catalog/banner.service";

export default async function AdminBannersPage() {
  await requirePlatformAdmin();
  const banners = await bannerService.listAll();

  return (
    <PageShell>
      <PageHeader
        title={BANNER_PAGE_COPY.listTitle}
        description={BANNER_PAGE_COPY.listDescription}
        actions={
          <Button asChild>
            <Link href={ROUTES.admin.newBanner} prefetch={false}>
              <Icon name="add" /> {BANNER_PAGE_COPY.add}
            </Link>
          </Button>
        }
      />
      <BannerList banners={banners} />
    </PageShell>
  );
}
