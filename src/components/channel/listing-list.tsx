import type { ChannelListingDTO, ListingGroupDTO, MarketplaceChannel } from "@server/channels/channel-connection.types";

import { ListingGroup } from "./listing-group";
import { ListingRow } from "./listing-row";

interface ListingListProps {
  orgId: string;
  shopName: string;
  channel: MarketplaceChannel;
  label: string;
  listings: ChannelListingDTO[];
  hrefFor: (listingId: string) => string;
  /** What each group's header offers (family-merge D6). */
  groups?: Record<string, ListingGroupDTO>;
  firstFamily?: boolean;
}

type Block = { parent: null; row: ChannelListingDTO } | { parent: string; title: string; axis: string | null; rows: ChannelListingDTO[] };

/** Rows in their order, with an Amazon variation family's children gathered under its header (Q9). */
function blocks(listings: ChannelListingDTO[]): Block[] {
  const out: Block[] = [];
  for (const row of listings) {
    const last = out[out.length - 1];
    if (row.parentSku && last && last.parent === row.parentSku) {
      last.rows.push(row);
    } else if (row.parentSku) {
      out.push({ parent: row.parentSku, title: row.parentTitle ?? row.parentSku, axis: row.variationAxis, rows: [row] });
    } else {
      out.push({ parent: null, row });
    }
  }
  return out;
}

export function ListingList({ orgId, shopName, channel, label, listings, hrefFor, groups = {}, firstFamily = false }: ListingListProps) {
  const all = blocks(listings);
  // The first group that can be settled explains itself, until a family exists (family-merge Q22).
  const introParent = firstFamily ? all.find((b) => b.parent !== null && groups[b.parent])?.parent ?? null : null;
  return (
    <ul className="rounded-card border bg-card px-4">
      {all.map((block, i) =>
        block.parent === null ? (
          <ListingRow key={block.row.id} orgId={orgId} shopName={shopName} channel={channel} label={label} listing={block.row} href={hrefFor(block.row.id)} />
        ) : (
          <ListingGroup
            key={`group-${block.parent}-${i}`}
            orgId={orgId}
            title={block.title}
            count={block.rows.length}
            axis={block.axis}
            label={label}
            group={groups[block.parent] ?? null}
            intro={block.parent === introParent}
          >
            {block.rows.map((row) => (
              <ListingRow key={row.id} orgId={orgId} shopName={shopName} channel={channel} label={label} listing={row} href={hrefFor(row.id)} indented />
            ))}
          </ListingGroup>
        ),
      )}
    </ul>
  );
}
