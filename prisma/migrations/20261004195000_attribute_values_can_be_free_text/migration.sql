-- Some channels take any text where others take a value from a list of their own.
--
-- Google's colour, material and pattern are free text; Flipkart's are closed lists of 35, 140 and
-- 56 values. Without somewhere to say which, the gate reports every answer as having no
-- equivalent on a channel that needs no equivalent — "no Google word for maroon", when Google
-- takes the word maroon.
--
-- A property of the channel's own field, so it belongs on the attribute mapping beside `required`.
ALTER TABLE "ChannelAttributeMap"
  ADD COLUMN IF NOT EXISTS "freeText" BOOLEAN NOT NULL DEFAULT false;
