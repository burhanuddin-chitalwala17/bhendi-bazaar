-- A carrier's catalogue row is reference data, not a fixture: checkout cannot quote a rate
-- until one exists, and prisma/seed.ts is destructive so it only ever runs on a developer's
-- machine. That is why production had zero providers while dev had one. Registering the row
-- here is what carries it to every environment on merge.
--
-- No credentials are set: an operator connects the account from the admin console
-- (server/shipping/adr/0002-credentials-via-admin-not-env.md), so isConnected stays false.
--
-- ON CONFLICT keeps this a no-op where the seed already created the row.
INSERT INTO "ShippingProvider" (
    "id",
    "code",
    "name",
    "description",
    "priority",
    "isConnected",
    "connectionType",
    "paymentOptions",
    "deliveryModes",
    "logoUrl",
    "websiteUrl",
    "createdAt",
    "updatedAt"
) VALUES (
    'shiprocket_001',
    'shiprocket',
    'Shiprocket',
    'India''s leading shipping aggregator with 17+ courier partners including Blue Dart, Delhivery, DTDC, FedEx, and more. Offers best-in-class delivery rates and pan-India coverage.',
    1,
    false,
    'email_password',
    ARRAY['prepaid', 'cod'],
    ARRAY['air', 'surface'],
    'https://shiprocket.in/wp-content/uploads/2021/07/shiprocket-logo-blue.svg',
    'https://www.shiprocket.in',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
