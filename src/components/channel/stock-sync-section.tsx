import Link from "next/link";

import { Button } from "@/components/ui/button";
import { STOCK_PROBLEM, STOCK_SYNC, type LocationMatchDTO, type StockSyncSectionDTO } from "@server/channels/channel-stock.types";

import { LocationMatchSheet } from "./location-match-sheet";
import { STOCK } from "./stock-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * Stock sync on a marketplace's Listings page, only when it needs the shop (inventory-sync Q28): sync
 * runs on its own once connected, so a healthy sync shows nothing. Pause lives on the Channels card.
 */
export function StockSyncSection({ orgId, section, locations }: { orgId: string; section: StockSyncSectionDTO; locations: LocationMatchDTO }) {
  const l = section.label;
  const matchButton = (text: string) => (
    <LocationMatchSheet orgId={orgId} match={locations} trigger={<Button variant="outline" size="sm" className="min-h-10 self-start">{text}</Button>} />
  );
  const toChannels = (
    <Button asChild variant="outline" size="sm" className="min-h-10 self-start">
      <Link href={ROUTES.org.channels(orgId)}>{STOCK.goToChannels}</Link>
    </Button>
  );
  const on = section.state === STOCK_SYNC.ON;

  const body = () => {
    if (section.needsReconnect) {
      return (
        <>
          <p className="text-sm font-medium text-destructive">{STOCK.reconnect(l)}</p>
          {toChannels}
        </>
      );
    }
    if (section.state === STOCK_SYNC.PAUSED) {
      return (
        <>
          <p className="text-sm">{STOCK.pausedLine(l)}</p>
          {toChannels}
        </>
      );
    }
    if (on && section.problem === STOCK_PROBLEM.REFUSED) return <p className="text-sm font-medium text-warning">{STOCK.notAllowed(l)}</p>;
    if (on && section.newLocation) {
      return (
        <>
          <p className="text-sm font-medium text-warning">{STOCK.newLocation(l, section.newLocation.name, section.newLocation.pincode)}</p>
          {matchButton(STOCK.matchIt)}
        </>
      );
    }
    if (section.locationsRead && section.locationsToMatch) {
      return (
        <>
          <p className="text-sm font-medium text-warning">{STOCK.locationsToMatch(l)}</p>
          {matchButton(STOCK.matchLocations)}
        </>
      );
    }
    if (!on) return null;
    const lines = [
      section.problem === STOCK_PROBLEM.BUSY ? STOCK.busy(l) : null,
      section.refused > 0 ? STOCK.refused(l, section.refused) : null,
    ].filter((t): t is string => t !== null);
    return lines.length > 0 ? lines.map((t) => <p key={t} className="text-sm text-warning">{t}</p>) : null;
  };

  const content = body();
  if (!content) return null;
  return (
    <section className="flex flex-col gap-2 rounded-card border bg-card p-4">
      <h2 className="text-base font-semibold">{section.state === STOCK_SYNC.PAUSED ? STOCK.paused : STOCK.title}</h2>
      {content}
    </section>
  );
}
