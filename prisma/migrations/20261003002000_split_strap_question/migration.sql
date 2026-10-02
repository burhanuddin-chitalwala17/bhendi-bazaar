-- Split one list that held two different questions.
--
-- The value generator mapped Flipkart's `Sling Strap` and Meesho's `Shoulder Strap` onto one
-- `strap` list on the assumption they were two platforms' words for one question. They are not:
-- Flipkart asks whether the strap **comes off** (Detachable / Non-Detachable) and Meesho asks
-- whether it is **padded** (Padded / Non Padded). Merged, a seller was offered four options to
-- one question, two of which answered a different one.
--
-- Both are facts a shop can answer by looking at the bag, so both stay — as two facts
-- ([ADR-0047](../../docs/adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)),
-- not one list with four values.
--
-- Nothing stores either yet: no product has been saved through the new form. So this moves rows
-- rather than migrating answers.
UPDATE "ListingValue"
   SET "list" = 'strapPadding'
 WHERE "list" = 'strap'
   AND "label" IN ('Padded', 'Non Padded');

-- And the bag type asks both, since a bag is where the question arises.
UPDATE "ProductType"
   SET "facts" = array_append("facts", 'strapPadding')
 WHERE "key" = 'bag'
   AND NOT ('strapPadding' = ANY("facts"));
