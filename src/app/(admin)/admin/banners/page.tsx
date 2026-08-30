/** The storefront hero, in the order a shopper sees it. */
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BannerList } from "@/components/banners/BannerList";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { bannerService } from "@server/catalog/banner.service";

export default async function AdminBannersPage() {
  await requirePlatformAdmin();
  const banners = await bannerService.listAll();

  return (
    <PageShell>
      <PageHeader
        title="Banners"
        description="The storefront hero, top to bottom in the order shoppers see it"
        actions={
          <Button asChild>
            <Link href="/admin/banners/new" prefetch={false}>
              <Plus /> Add banner
            </Link>
          </Button>
        }
      />
      <BannerList banners={banners} />
    </PageShell>
  );
}
