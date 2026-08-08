-- `Category.accentColorClass` held raw Tailwind class strings — presentation stored as
-- data, in two incompatible shapes (flat washes from the form, gradient triplets from
-- seeds). It becomes `accent`, a semantic key mapped to classes at render.
--
-- Hand-written. The CASE maps every value shape observed in the database; a value it
-- does not recognise is left as-is so the enum cast FAILS LOUDLY rather than silently
-- inventing a colour. Check first:  SELECT DISTINCT "accentColorClass" FROM "Category";

CREATE TYPE "CategoryAccent" AS ENUM ('EMERALD','BLUE','PURPLE','PINK','ORANGE','YELLOW','RED','GRAY');

ALTER TABLE "Category" RENAME COLUMN "accentColorClass" TO "accent";

UPDATE "Category" SET "accent" = CASE
  WHEN "accent" LIKE '%emerald%' THEN 'EMERALD'
  WHEN "accent" LIKE '%amber%'   THEN 'ORANGE'
  WHEN "accent" LIKE '%orange%'  THEN 'ORANGE'
  WHEN "accent" LIKE '%yellow%'  THEN 'YELLOW'
  WHEN "accent" LIKE '%sky%'     THEN 'BLUE'
  WHEN "accent" LIKE '%blue%'    THEN 'BLUE'
  WHEN "accent" LIKE '%purple%'  THEN 'PURPLE'
  WHEN "accent" LIKE '%pink%'    THEN 'PINK'
  WHEN "accent" LIKE '%red%'     THEN 'RED'
  WHEN "accent" LIKE '%gray%'    THEN 'GRAY'
  WHEN "accent" LIKE '%primary%' THEN 'EMERALD'  -- one PR-33 codemod artifact shape
  ELSE "accent"
END;

ALTER TABLE "Category" ALTER COLUMN "accent" TYPE "CategoryAccent" USING "accent"::"CategoryAccent";
ALTER TABLE "Category" ALTER COLUMN "accent" SET DEFAULT 'EMERALD';
