import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BannerForm } from "@/components/banners/BannerForm";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { bannerRepository } from "@server/catalog/banner.repository";

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
        back={{ href: "/admin/banners", label: "Back to banners" }}
        title="Edit banner"
        description={banner.title}
      />
      <BannerForm
        action={`/api/admin/banners/${id}`}
        method="PATCH"
        initial={{
          title: banner.title,
          eyebrow: banner.eyebrow,
          description: banner.description,
          imageUrl: banner.imageUrl,
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
