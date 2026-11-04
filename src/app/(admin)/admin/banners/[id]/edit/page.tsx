import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BannerForm } from "@/components/banners/BannerForm";
import { BANNER_PAGE_COPY } from "@/components/banners/banner-copy";
import { ROUTES } from "@server/shared/routes";
import { bannerLabel } from "@/lib/banner-label";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { bannerRepository } from "@server/catalog/banner.repository";
import { toImageSlotValue } from "@server/catalog/image-framing";

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;
  const banner = await bannerRepository.findById(id);
  if (!banner) notFound();

  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: ROUTES.admin.banners, label: BANNER_PAGE_COPY.back }}
        title={BANNER_PAGE_COPY.editTitle}
        description={bannerLabel(banner.title)}
      />
      <BannerForm
        action={`/api/admin/banners/${id}`}
        method="PATCH"
        initial={{
          title: banner.title,
          eyebrow: banner.eyebrow,
          description: banner.description,
          image: toImageSlotValue(banner),
          imageAlt: banner.imageAlt,
          isActive: banner.isActive,
          actions: banner.actions.map(({ label, href, variant }) => ({
            label,
            href,
            variant,
          })),
        }}
      />
    </PageShell>
  );
}
