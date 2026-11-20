import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ISSUE_NEED, type ListingScreenDTO } from "@server/channels/platform-listing.types";

import { CREATE, PUBLISH } from "./platform-listing-copy";
import { ROUTES } from "@server/shared/routes";
import { withFrom } from "@/lib/safe-callback-url";

/**
 * A listing not yet on the marketplace (marketplace-publish ux.md "Put on Amazon", Partial): how it
 * will be made, what the marketplace still needs (readiness, never a gate), and the barcode path (Q8).
 */
export function ListingDraftBanner({ orgId, screen, from }: { orgId: string; screen: ListingScreenDTO; from?: string }) {
  const draft = screen.draft;
  const editProduct = from ? withFrom(ROUTES.org.editProduct(orgId, screen.productId), from) : ROUTES.org.editProduct(orgId, screen.productId);
  if (!draft) return null;
  const needsBarcode = screen.issues.some((i) => i.need === ISSUE_NEED.BARCODE || /identifier|gtin|barcode|ean|upc/i.test(`${i.code} ${i.message}`));
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
            <Link href={editProduct}>{CREATE.fillOnProduct}</Link>
          </Button>
        </div>
      )}
      {needsBarcode && (
        <div className="flex flex-col items-start gap-1">
          <p className="font-semibold">{PUBLISH.barcodeNeeded(screen.locked.brand ?? screen.productName)}</p>
          <p>{PUBLISH.barcodeHow}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <Link href={editProduct}>{PUBLISH.addBarcode}</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <a href={PUBLISH.exemptionUrl} target="_blank" rel="noreferrer">{PUBLISH.exemptionHow}</a>
            </Button>
          </div>
        </div>
      )}
      <p className="text-muted-foreground">{CREATE.draftNoteFor(screen.status.status, screen.label)}</p>
    </section>
  );
}
