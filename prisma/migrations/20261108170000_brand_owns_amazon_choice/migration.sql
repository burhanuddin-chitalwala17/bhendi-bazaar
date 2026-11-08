-- listing-model/dynamic-form unit 4 (R7, attributes Q16): the brand page now asks "Registered on Amazon / list
-- as Generic" per brand, so the shop-wide switch stops setting every brand. Each brand keeps the choice it
-- holds today; nothing changes on deploy. The switch's column stays for a product with no brand until
-- retire-old-paths. Drops one trigger and its function; no data is touched.
DROP TRIGGER IF EXISTS "OrgListingDefaults_generic_to_brands" ON "OrgListingDefaults";
DROP FUNCTION IF EXISTS bb_brands_follow_generic();
