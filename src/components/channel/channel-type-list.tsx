import { ResourceList, type ResourceColumn } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import type { AdminChannelTypeDTO } from "@server/listing/admin.field-map.types";
import { ROUTES } from "@server/shared/routes";
import { FIELD_MAP_COPY } from "./field-map-copy";

/** A channel's types, each linking to how its fields are filled (listing-model/field-maps ux.md "Channel types"). */
export function ChannelTypeList({ channel, types }: { channel: string; types: readonly AdminChannelTypeDTO[] }) {
  const columns: ResourceColumn<AdminChannelTypeDTO>[] = [
    { key: "label", label: FIELD_MAP_COPY.typeColumn, cell: (t) => t.label, phone: "title" },
    { key: "required", label: FIELD_MAP_COPY.requiredColumn, cell: (t) => FIELD_MAP_COPY.required(t.required), phone: "meta" },
    {
      key: "unmapped", label: FIELD_MAP_COPY.unmappedColumn, phone: "status",
      cell: (t) => <StatusBadge tone={t.unmapped > 0 ? "warning" : "success"}>{FIELD_MAP_COPY.unmapped(t.unmapped)}</StatusBadge>,
    },
  ];
  return (
    <ResourceList
      rows={types}
      rowKey={(t) => t.key}
      columns={columns}
      label={FIELD_MAP_COPY.typesLabel}
      rowHref={(t) => ROUTES.admin.channelType(channel, t.key)}
      empty={{ title: FIELD_MAP_COPY.noTypes, description: FIELD_MAP_COPY.noTypesBody }}
    />
  );
}
