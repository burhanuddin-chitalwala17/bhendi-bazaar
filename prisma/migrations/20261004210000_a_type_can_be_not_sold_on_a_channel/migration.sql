-- "Not sold here, on purpose" is a decision, and until now it looked exactly like not deciding.
--
-- Combos are the case: the owner's call on 2026-10-04 is that gift, prayer and masalla sets sell
-- on this store only. That was recorded by writing no row — and no row is also what "nobody has
-- chosen yet" looks like, so the register listed 18 masalla bags as work to do. A to-do list that
-- keeps naming a decision already taken is a list that stops being read.
--
-- It lives on the category mapping rather than in a table of its own because it is the same
-- decision with a third answer — their word for it, the nearest they have, or nowhere — and it
-- must obey the same kind precedence: a type not sold on a channel, with one kind of it that is.
-- `categoryFor` already resolves that and is tested; a second table would be a second copy of it.
--
-- `theirCategory` becomes nullable because a row saying "nowhere" has no category to name, and an
-- empty string would be a null wearing a disguise.

ALTER TABLE "ChannelCategoryMap"
  ADD COLUMN IF NOT EXISTS "notSold" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ChannelCategoryMap"
  ALTER COLUMN "theirCategory" DROP NOT NULL;

-- A row either names a category or says nowhere; it cannot do both and cannot do neither.
ALTER TABLE "ChannelCategoryMap"
  DROP CONSTRAINT IF EXISTS "ChannelCategoryMap_sold_xor_not";
ALTER TABLE "ChannelCategoryMap"
  ADD CONSTRAINT "ChannelCategoryMap_sold_xor_not"
  CHECK (("notSold" AND "theirCategory" IS NULL) OR (NOT "notSold" AND "theirCategory" IS NOT NULL));
