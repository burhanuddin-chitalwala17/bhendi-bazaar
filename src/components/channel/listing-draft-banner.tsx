import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ListingScreenDTO } from "@server/channels/platform-listing.types";

import { CREATE, PUBLISH } from "./platform-listing-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * A listing not yet on the marketplace (marketplace-publish ux.md "Put on Amazon", Partial): how it
 * will be made, what the marketplace still needs (readiness, never a gate), and the barcode path (Q8).
 */
export function ListingDraftBanner({ orgId, screen }: { orgId: string; screen: ListingScreenDTO }) {
  const draft = screen.draft;
  if (!draft) return null;
  const needsBarcode = screen.issues.some((i) => /identifier|gtin|barcode|ean|upc/i.test(`${i.code} ${i.message}`));
  return (
    <section className="flex flex-col gap-2 rounded-card bg-warning/10 p-3 text-sm">
      {draft.mode === "offer" ? (
        <p>{`${CREATE.sellHere} · ASIN ${draft.targetExternalId ?? ""}`}</p>
      ) : (
        <p>{`${CREATE.category}: ${draft.marketplaceType ?? CREATE.noCategory}`}</p>
      )}
      {draft.mode === "new" && !screen.locked.barcode && <p className="text-muted-foreground">{`Barcode: ${CREATE.noBarcode}`}</p>}
      {draft.stillNeeds.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          <p className="font-semibold">{CREATE.stillNeeds(draft.stillNeeds.join(", "))}</p>
          <Button asChild variant="link" size="sm" className="h-auto min-h-10 p-0">
            <Link href={ROUTES.org.editProduct(orgId, screen.productId)}>{CREATE.fillOnProduct}</Link>
          </Button>
        </div>
      )}
      {needsBarcode && (
        <div className="flex flex-col items-start gap-1">
          <p className="font-semibold">{PUBLISH.barcodeNeeded(screen.locked.brand ?? screen.productName)}</p>
          <p>{PUBLISH.barcodeHow}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <Link href={ROUTES.org.editProduct(orgId, screen.productId)}>{PUBLISH.addBarcode}</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <a href={PUBLISH.exemptionUrl} target="_blank" rel="noreferrer">{PUBLISH.exemptionHow}</a>
            </Button>
          </div>
        </div>
      )}
      <p className="text-muted-foreground">{CREATE.draftNote}</p>
    </section>
  );
}
