import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BannerForm } from "@/components/banners/BannerForm";
import { BANNER_PAGE_COPY } from "@/components/banners/banner-copy";
import { ROUTES } from "@server/shared/routes";
import { requirePlatformAdmin } from "@/lib/admin-auth";

export default async function NewBannerPage() {
  await requirePlatformAdmin();
  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: ROUTES.admin.banners, label: BANNER_PAGE_COPY.back }}
        title={BANNER_PAGE_COPY.newTitle}
        description={BANNER_PAGE_COPY.newDescription}
      />
      <BannerForm action="/api/admin/banners" />
    </PageShell>
  );
}
