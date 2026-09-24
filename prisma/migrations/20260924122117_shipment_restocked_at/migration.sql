-- The idempotency marker for returning a parcel's units to stock. A courier may report the same
-- terminal state more than once, and crediting the same units twice invents inventory
-- (docs/specs/shipment-lifecycle/ D7).
ALTER TABLE "Shipment" ADD COLUMN "restockedAt" TIMESTAMP(3);
