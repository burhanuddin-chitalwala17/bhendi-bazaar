/**
 * One channel's dictionary and what is still to decide — a server component ([ADR-0034]).
 *
 * Two worklists, both built from what this catalogue actually sells: answers with no word on
 * this channel, and product types with nowhere to go. A nearest fit is listed separately because
 * it is not work — it is a decision already taken that every affected product keeps showing
 * (channel-registry D6, D12).
 */
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminChannelRegisterDAL } from "@/data-access-layer/admin/channel-register.dal";
import { UnmappedValueRow } from "@/components/channel/unmapped-value-row";
import { NotSoldButton } from "@/components/channel/not-sold-button";
import { isChannel } from "@server/shared/channels";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminChannelPage({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel } = await params;
  if (!isChannel(channel)) notFound();
  const view = await adminChannelRegisterDAL.getView(channel);

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.label}
        description={`${view.counts.categories} categories, ${view.counts.attributes} fields and ${view.counts.values} answers mapped. Nothing here publishes.`}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Answers with no word here</h2>
          <p className="text-sm text-muted-foreground">
            Only what products actually answer. One decision clears every product using that
            value — and changes it for them all, so a correction works the same way.
          </p>
        </div>
        {view.unmappedValues.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Every answer this catalogue gives has a word on {view.label}.
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
            <h2 className="text-lg font-semibold">Products with nowhere to go</h2>
            <p className="text-sm text-muted-foreground">
              These types sell here but no category on {view.label} has been chosen for them.
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
                    <p className="text-sm text-muted-foreground">
                      {entry.products} {entry.products === 1 ? "product" : "products"}
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
            <h2 className="text-lg font-semibold">Not sold on {view.label}</h2>
            <p className="text-sm text-muted-foreground">
              Decided, not overlooked — so they stay off the list above. Change your mind here and
              they go back to it, with the choice still to make.
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
                    <p className="text-sm text-muted-foreground">
                      {entry.products} {entry.products === 1 ? "product" : "products"}, sold on
                      this store only
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
            <h2 className="text-lg font-semibold">Listed as the nearest they have</h2>
            <p className="text-sm text-muted-foreground">
              Not work to do — decisions already taken. Every product they affect shows the note
              below, every time.
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
                    <Badge variant="secondary">{fit.theirCategory}</Badge>
                  </div>
                  {fit.note && <p className="text-sm text-muted-foreground">{fit.note}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
