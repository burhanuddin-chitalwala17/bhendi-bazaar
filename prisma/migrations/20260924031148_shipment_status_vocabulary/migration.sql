-- Shipment.status had three vocabularies: the `ShipmentStatus` type, the schema comment, and
-- what the code actually wrote. One set now wins (docs/specs/shipment-lifecycle/).
--
-- A data migration rather than a seed: the seed is destructive and dev-only, so anything
-- production cannot run without ships here (CLAUDE.md Invariant 7).
--
-- `shipped` is the one judgement call. It was written by the admin console when a tracking
-- number was added — which is the moment the courier takes the parcel, so `picked_up` is
-- arguably truer. `in_transit` is chosen because the next courier event corrects it within
-- hours, and over-reporting progress to a buyer is worse than under-reporting it.
UPDATE "Shipment" SET "status" = 'packing'    WHERE "status" IN ('pending', 'processing', 'packed', 'created');
UPDATE "Shipment" SET "status" = 'in_transit' WHERE "status" = 'shipped';
UPDATE "Shipment" SET "status" = 'rto_in_transit' WHERE "status" = 'returned';
UPDATE "Shipment" SET "status" = 'lost'       WHERE "status" = 'failed';

-- The default matched none of the vocabularies the code used. It now names a real state.
ALTER TABLE "Shipment" ALTER COLUMN "status" SET DEFAULT 'packing';
