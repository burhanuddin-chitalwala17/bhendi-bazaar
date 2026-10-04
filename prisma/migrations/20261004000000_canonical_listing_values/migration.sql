-- One canonical value per concept, where the union of two platforms' vocabularies gave it two.
--
-- Seeding the union (PR-230) was right for colour, where 188 values are genuinely different
-- shades. It was poor for small lists, where one concept arrived twice because Flipkart and
-- Meesho word it differently — a seller offered High and High Rise is being asked to pick
-- between two spellings of the same answer.
--
-- **Retired, not deleted** ([ADR-0032](../../docs/adr/0032-records-people-authored-are-retired-not-deleted.md)).
-- The discarded word is the one that platform uses, and the mapping layer will need it: our
-- Full Sleeves is Meesho's Long Sleeves. Retiring hides it from every picker, keeps it readable
-- on anything that stored it, and leaves the word where the mapping can find it
-- ([ADR-0045](../../docs/adr/0045-channel-mappings-are-versioned-data.md)).
--
-- The choice of word, by the owner on 2026-10-04: **"full sleeves is the correct term"** — the
-- trade's word, not the one that happens to be shorter or longer. The rest follow it:
--
--   sleeveLength   Full Sleeves          over  Long Sleeves           (owner)
--                  Half Sleeves          over  Short Sleeves          (the same pair, inverted)
--                  Three-Quarter Sleeves over  3/4 Sleeve             (words, not a fraction)
--   waistRise      High/Low/Mid Rise     over  High/Low/Mid           (a dropdown entry that
--                                                                      reads alone)
--   fit            Comfort/Loose/        over  Comfort/Loose/
--                  Regular/Straight Fit        Regular/Straight       (same, and it matches the
--                                                                      Athletic/Skinny/Slim Fit
--                                                                      already in the list)
--   surfaceStyling Slits                 over  Slit                   (a plural, like its peers)

-- Retire the word we are not keeping.
UPDATE "ListingValue" SET "retiredAt" = now()
 WHERE "orgId" IS NULL AND "retiredAt" IS NULL
   AND ( ("list" = 'sleeveLength'   AND "label" IN ('Long Sleeves', 'Short Sleeves', '3/4 Sleeve'))
      OR ("list" = 'waistRise'      AND "label" IN ('High', 'Low', 'Mid'))
      OR ("list" = 'fit'            AND "label" IN ('Comfort', 'Loose', 'Regular', 'Straight'))
      OR ("list" = 'surfaceStyling' AND "label" = 'Slit') );

-- Say it the way the trade says it. Flipkart writes the singular; this store does not.
UPDATE "ListingValue" SET "label" = 'Full Sleeves', "key" = 'full-sleeves'
 WHERE "orgId" IS NULL AND "list" = 'sleeveLength' AND "label" = 'Full Sleeve';
UPDATE "ListingValue" SET "label" = 'Half Sleeves', "key" = 'half-sleeves'
 WHERE "orgId" IS NULL AND "list" = 'sleeveLength' AND "label" = 'Half Sleeve';
UPDATE "ListingValue" SET "label" = 'Roll-up Sleeves', "key" = 'roll-up-sleeves'
 WHERE "orgId" IS NULL AND "list" = 'sleeveLength' AND "label" = 'Roll-up Sleeve';
