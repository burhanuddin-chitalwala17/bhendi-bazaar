import type { ChannelListingDTO, MarketplaceChannel } from "@server/channels/channel-connection.types";

import { ListingGroup } from "./listing-group";
import { ListingRow } from "./listing-row";

interface ListingListProps {
  orgId: string;
  shopName: string;
  channel: MarketplaceChannel;
  label: string;
  listings: ChannelListingDTO[];
  hrefFor: (listingId: string) => string;
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

export function ListingList({ orgId, shopName, channel, label, listings, hrefFor }: ListingListProps) {
  return (
    <ul className="rounded-card border bg-card px-4">
      {blocks(listings).map((block, i) =>
        block.parent === null ? (
          <ListingRow key={block.row.id} orgId={orgId} shopName={shopName} channel={channel} label={label} listing={block.row} href={hrefFor(block.row.id)} />
        ) : (
          <ListingGroup key={`group-${block.parent}-${i}`} title={block.title} count={block.rows.length} axis={block.axis} label={label}>
            {block.rows.map((row) => (
              <ListingRow key={row.id} orgId={orgId} shopName={shopName} channel={channel} label={label} listing={row} href={hrefFor(row.id)} indented />
            ))}
          </ListingGroup>
        ),
      )}
    </ul>
  );
}
