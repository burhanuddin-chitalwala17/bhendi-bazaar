-- One spelling per value.
--
-- The union of two platforms' vocabularies also brought the same word twice where they
-- hyphenate, space or pluralise it differently — Cut-Outs beside Cutouts, Polka Dot beside Polka
-- Dots. Unlike the wording pairs the owner settled, these need no judgement: they are one answer
-- spelled two ways, and a seller offered both is being asked to pick a typo.
--
-- The convention, stated once so it can be applied again: **the spaced form, and the plural where
-- the thing is naturally countable** — Polka Dots, Stripes, Perforations — except where one word
-- is the established trade term, which keeps its own spelling: Polycotton, Cutwork, Cut-Outs.
--
-- Retired rather than deleted, like the wording pairs: the discarded spelling is what one
-- platform writes, and the mapping layer will need it
-- ([ADR-0045](../../docs/adr/0045-channel-mappings-are-versioned-data.md)).
UPDATE "ListingValue" SET "retiredAt" = now()
 WHERE "orgId" IS NULL AND "retiredAt" IS NULL
   AND ( ("list" = 'closure'        AND "label" = 'Turnlock')
      OR ("list" = 'colour'         AND "label" IN ('Grey Melanges', 'GreyMelange'))
      OR ("list" = 'material'       AND "label" = 'Poly Cotton')
      OR ("list" = 'pattern'        AND "label" IN ('Colorblock', 'Colorblocked', 'Ethnic Motif',
                                                     'Perforation', 'Polka Dot', 'Stripe'))
      OR ("list" = 'scentFamily'    AND "label" IN ('Aloevera', 'Fruit'))
      OR ("list" = 'surfaceStyling' AND "label" IN ('Cut Work', 'Cutouts')) );
