import Link from "next/link";

import { Button } from "@/components/ui/button";
import { STOCK_PROBLEM, STOCK_SYNC, type LocationMatchDTO, type StockSyncSectionDTO } from "@server/channels/channel-stock.types";

import { ago } from "./listing-copy";
import { LocationMatchSheet } from "./location-match-sheet";
import { STOCK } from "./stock-copy";
import { StockSyncActions } from "./stock-sync-actions";

/**
 * Stock sync on a marketplace's Listings page (inventory-sync ux.md "Stock sync section"): where it
 * stands, and the one thing to do next. Rendered on the server; the actions are client leaves.
 */
export function StockSyncSection({ orgId, section, locations }: { orgId: string; section: StockSyncSectionDTO; locations: LocationMatchDTO }) {
  const l = section.label;
  const now = Date.now();
  const matchButton = (text: string) => (
    <LocationMatchSheet orgId={orgId} match={locations} trigger={<Button variant="outline" size="sm" className="min-h-10 self-start">{text}</Button>} />
  );

  const body = () => {
    if (section.needsReconnect) {
      return (
        <>
          <p className="text-sm font-medium text-destructive">{STOCK.reconnect(l)}</p>
          <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
            <Link href={`/org/${orgId}/channels`}>{STOCK.goToChannels}</Link>
          </Button>
        </>
      );
    }
    if (section.problem === STOCK_PROBLEM.REFUSED && section.state === STOCK_SYNC.ON) return <p className="text-sm font-medium text-warning">{STOCK.notAllowed(l)}</p>;
    if (section.allHeldByMarketplace) return <p className="text-sm text-muted-foreground">{STOCK.allHeld(l)}</p>;
    if (section.newLocation && section.state === STOCK_SYNC.ON) {
      return (
        <>
          <p className="text-sm text-muted-foreground">{STOCK.onLine(section.sentAt && ago(section.sentAt, now), section.checkedAt && ago(section.checkedAt, now))}</p>
          <p className="text-sm font-medium text-warning">{STOCK.newLocation(l, section.newLocation.name, section.newLocation.pincode)}</p>
          {matchButton(STOCK.matchIt)}
        </>
      );
    }
    if (section.locationsToMatch) {
      return (
        <>
          <p className="text-sm font-medium text-warning">{STOCK.locationsToMatch(l)}</p>
          {matchButton(STOCK.matchLocations)}
        </>
      );
    }
    if (section.state === STOCK_SYNC.ON) {
      return (
        <>
          <p className="text-sm text-muted-foreground">
            {section.sending ? STOCK.sending(l, section.sending.sent, section.sending.total) : STOCK.onLine(section.sentAt && ago(section.sentAt, now), section.checkedAt && ago(section.checkedAt, now))}
          </p>
          {section.problem === STOCK_PROBLEM.BUSY && <p className="text-sm text-warning">{STOCK.busy(l)}</p>}
          {section.refused > 0 && <p className="text-sm text-warning">{STOCK.refused(l, section.refused)}</p>}
          {section.corrections.length > 0 && (
            <p className="text-sm">
              {STOCK.corrected(section.corrections.length, STOCK.correctedOne(section.corrections[0].title, section.corrections[0].theirs, section.corrections[0].ours))}
            </p>
          )}
          <StockSyncActions orgId={orgId} channel={section.channel} label={l} state={STOCK_SYNC.ON} />
        </>
      );
    }
    if (section.state === STOCK_SYNC.PAUSED) {
      return (
        <>
          <p className="text-sm">{STOCK.pausedLine(l)}</p>
          <StockSyncActions orgId={orgId} channel={section.channel} label={l} state={STOCK_SYNC.PAUSED} />
        </>
      );
    }
    return (
      <>
        <p className="text-sm">{STOCK.off(l)}</p>
        <StockSyncActions orgId={orgId} channel={section.channel} label={l} state={STOCK_SYNC.OFF} />
      </>
    );
  };

  return (
    <section className="flex flex-col gap-2 rounded-card border bg-card p-4">
      <h2 className="text-base font-semibold">{section.state === STOCK_SYNC.ON ? STOCK.on : section.state === STOCK_SYNC.PAUSED ? STOCK.paused : STOCK.title}</h2>
      {body()}
    </section>
  );
}
