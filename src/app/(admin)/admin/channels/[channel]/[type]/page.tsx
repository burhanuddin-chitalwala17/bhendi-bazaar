/**
 * Where each field of one channel type gets its value — a server component ([ADR-0034]); the edit is
 * the smallest client leaf (listing-model/field-maps R6, ux.md).
 */
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-shell";
import { FieldMapList } from "@/components/channel/field-map-list";
import { FIELD_MAP_COPY } from "@/components/channel/field-map-copy";
import { adminFieldMapsDAL } from "@/data-access-layer/admin/field-maps.dal";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminChannelTypePage({ params }: { params: Promise<{ channel: string; type: string }> }) {
  const { channel, type } = await params;
  const view = await adminFieldMapsDAL.getView(channel, decodeURIComponent(type));
  if (!view) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`${view.channelLabel} · ${view.typeLabel}`} description={FIELD_MAP_COPY.description(view.channelLabel, view.readAt)} />
      <FieldMapList view={view} />
    </div>
  );
}
