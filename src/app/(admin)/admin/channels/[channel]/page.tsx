/**
 * One channel's dictionary and what is still to decide — a server component ([ADR-0034]).
 *
 * Two worklists, both built from what this catalogue actually sells: answers with no word on
 * this channel, and product types with nowhere to go. A nearest fit is listed separately because
 * it is not work — it is a decision already taken that every affected product keeps showing
 * (channel-registry D6, D12).
 */
import { ChannelTypesEditor } from "@/components/channel/channel-types-editor";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { adminChannelRegisterDAL } from "@/data-access-layer/admin/channel-register.dal";
import { UnmappedValueRow } from "@/components/channel/unmapped-value-row";
import { NotSoldButton } from "@/components/channel/not-sold-button";
import { isChannel } from "@server/shared/channels";
import { ADMIN_CHANNEL_COPY } from "../channels-copy";
import { ChannelTypeList } from "@/components/channel/channel-type-list";
import { FIELD_MAP_COPY } from "@/components/channel/field-map-copy";
import { adminFieldMapsDAL } from "@/data-access-layer/admin/field-maps.dal";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminChannelPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel } = await params;
  if (!isChannel(channel)) notFound();
  const [view, types] = await Promise.all([adminChannelRegisterDAL.getView(channel), adminFieldMapsDAL.getTypes(channel)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.label}
        description={ADMIN_CHANNEL_COPY.description(view.counts)}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-title font-semibold">{ADMIN_CHANNEL_COPY.unmappedTitle}</h2>
          <p className="text-small text-muted-foreground">
            {ADMIN_CHANNEL_COPY.unmappedBody}
          </p>
        </div>
        {view.unmappedValues.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-small text-muted-foreground">
              {ADMIN_CHANNEL_COPY.allMapped(view.label)}
            </CardContent>
          </Card>
        ) : (
          <Card className="py-0">
            <ul className="divide-y">
              {view.unmappedValues.map((entry) => (
                <UnmappedValueRow
                  key={`${entry.list}:${entry.valueKey}`}
                  channel={channel}
                  entry={entry}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      {view.unmappedCategories.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-title font-semibold">{ADMIN_CHANNEL_COPY.nowhereTitle}</h2>
            <p className="text-small text-muted-foreground">
              {ADMIN_CHANNEL_COPY.nowhereBody(view.label)}
            </p>
          </div>
          <Card className="py-0">
            <ul className="divide-y">
              {view.unmappedCategories.map((entry) => (
                <li
                  key={`${entry.productType}:${entry.kind ?? "*"}`}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {entry.typeLabel}
                      {entry.kind && (
                        <span className="text-muted-foreground"> · {entry.kind}</span>
                      )}
                    </p>
                    <p className="text-small text-muted-foreground">
                      {ADMIN_CHANNEL_COPY.products(entry.products)}
                    </p>
                  </div>
                  <NotSoldButton
                    channel={channel}
                    productType={entry.productType}
                    kind={entry.kind}
                    label={entry.typeLabel}
                    marked={false}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {view.notSold.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-title font-semibold">{ADMIN_CHANNEL_COPY.notSoldTitle(view.label)}</h2>
            <p className="text-small text-muted-foreground">
              {ADMIN_CHANNEL_COPY.notSoldBody}
            </p>
          </div>
          <Card className="py-0">
            <ul className="divide-y">
              {view.notSold.map((entry) => (
                <li
                  key={`${entry.productType}:${entry.kind ?? "*"}`}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {entry.typeLabel}
                      {entry.kind && (
                        <span className="text-muted-foreground"> · {entry.kind}</span>
                      )}
                    </p>
                    <p className="text-small text-muted-foreground">
                      {ADMIN_CHANNEL_COPY.storeOnly(entry.products)}
                    </p>
                  </div>
                  <NotSoldButton
                    channel={channel}
                    productType={entry.productType}
                    kind={entry.kind}
                    label={entry.typeLabel}
                    marked
                  />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {view.nearestFits.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-title font-semibold">{ADMIN_CHANNEL_COPY.nearestTitle}</h2>
            <p className="text-small text-muted-foreground">
              {ADMIN_CHANNEL_COPY.nearestBody}
            </p>
          </div>
          <Card className="py-0">
            <ul className="divide-y">
              {view.nearestFits.map((fit) => (
                <li key={`${fit.productType}:${fit.kind ?? "*"}`} className="space-y-1 p-4">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="font-medium">
                      {fit.productType}
                      {fit.kind && <span className="text-muted-foreground"> · {fit.kind}</span>}
                    </p>
                    <StatusBadge tone="info">{fit.theirCategory}</StatusBadge>
                  </div>
                  {fit.note && <p className="text-small text-muted-foreground">{fit.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
      <section className="space-y-3">
        <div>
          <h2 className="text-title font-semibold">{FIELD_MAP_COPY.typesTitle}</h2>
          <p className="text-small text-muted-foreground">{FIELD_MAP_COPY.typesBody}</p>
        </div>
        <ChannelTypeList channel={channel} types={types} />
      </section>

      <ChannelTypesEditor
        channel={channel}
        label={view.label}
        types={view.types}
        suggestions={[...new Set(view.types.flatMap((t) => t.rows.map((r) => r.theirCategory)))].sort()}
      />
    </div>
  );
}
