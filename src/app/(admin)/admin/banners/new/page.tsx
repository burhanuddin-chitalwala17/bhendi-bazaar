import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BannerForm } from "@/components/banners/BannerForm";
import { requirePlatformAdmin } from "@/lib/admin-auth";

export default async function NewBannerPage() {
  await requirePlatformAdmin();
  return (
    <PageShell width="narrow">
      <PageHeader
        back={{ href: "/admin/banners", label: "Back to banners" }}
        title="New banner"
        description="It appends to the end of the hero; reorder from the list."
      />
      <BannerForm action="/api/admin/banners" />
    </PageShell>
  );
}
