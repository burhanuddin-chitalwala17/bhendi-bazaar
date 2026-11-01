-- order-fulfilment unit 3: booking, label, date change, timeline dates (docs/specs/own-store/order-fulfilment/trd.md D5, D7, D11).
-- Additive, plus one type change on a column nothing writes yet. Drops one index, which a wider one replaces.

-- D11: the booking's own facts. Both dates are calendar days in India, not moments (Q6).
ALTER TABLE "Shipment" ADD COLUMN "pickupDate" DATE;
ALTER TABLE "Shipment" ADD COLUMN "labelUrl" TEXT;
-- Always null before this unit (nothing wrote it); the cast reads any stray value as India's day.
ALTER TABLE "Shipment" ALTER COLUMN "estimatedDelivery" SET DATA TYPE DATE
  USING (("estimatedDelivery" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date;

-- D11: one AWB, one parcel. Blanks are no AWB; a duplicate stops the deploy for a person to look at.
UPDATE "Shipment" SET "trackingNumber" = NULL WHERE btrim("trackingNumber") = '';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Shipment" WHERE "trackingNumber" IS NOT NULL
    GROUP BY "trackingNumber" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Two parcels share an AWB. Resolve them before applying order-fulfilment unit 3 (D11).';
  END IF;
END $$;
CREATE UNIQUE INDEX "Shipment_trackingNumber_live_key" ON "Shipment"("trackingNumber") WHERE "trackingNumber" IS NOT NULL;

-- D5: a booking or a date change carries its dates and who on staff did it.
ALTER TABLE "ParcelEvent" ADD COLUMN "pickupDate" DATE;
ALTER TABLE "ParcelEvent" ADD COLUMN "estimatedDelivery" DATE;
ALTER TABLE "ParcelEvent" ADD COLUMN "actorName" TEXT;

-- D8: a date can change more than once, and each change emails. `ref` names the timeline row;
-- once-per-parcel kinds keep "" and so keep their old uniqueness.
ALTER TABLE "Notice" ADD COLUMN "ref" TEXT NOT NULL DEFAULT '';
DROP INDEX "Notice_shipmentId_kind_audience_key";
CREATE UNIQUE INDEX "Notice_shipmentId_kind_audience_ref_key" ON "Notice"("shipmentId", "kind", "audience", "ref");
