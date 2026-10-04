-- CreateTable
CREATE TABLE "ProductType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "facts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "measures" JSONB,
    "variantAxis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kinds" JSONB,
    "labelFrom" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "labelScale" JSONB,
    "retiredAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_key_key" ON "ProductType"("key");

-- CreateIndex
CREATE INDEX "ProductType_retiredAt_idx" ON "ProductType"("retiredAt");

-- The nine product types, carried across from `server/catalog/product-type.ts` unchanged
-- (product-types D10). A data migration rather than the seed: `prisma/seed.ts` is permanently
-- dev-only and deletes every table, while `vercel.json` runs `prisma migrate deploy` before every
-- build, so a migration reaches every environment on merge (Invariant 7). The test is whether
-- production breaks without them, and without these every product form has no questions.
--
-- They are inserted BEFORE the foreign keys below, so a database where a `productType` was
-- already set in testing does not fail the constraint the moment it is added.
--
-- Idempotent on the unique key, so replaying this migration is a no-op.

INSERT INTO "ProductType" ("id","key","label","facts","measures","variantAxis","kinds","labelFrom","labelScale","order","updatedAt")
SELECT v.id, v.key, v.label, v.facts, v.measures, v.axis, v.kinds, v.lf, v.ls, v.ord, now()
FROM (VALUES
  ('pt_islamic_wear', 'islamic-wear', 'Islamic wear', ARRAY['colour','material','pattern','sleeveLength','sleeveStyling','stitchType','audience','occasion','care']::TEXT[], '[{"key":"length","label":"Length","unit":"in","required":true},{"key":"bust","label":"Bust","unit":"in","required":true},{"key":"waist","label":"Waist","unit":"in","required":false},{"key":"hip","label":"Hip","unit":"in","required":false},{"key":"shoulder","label":"Shoulder","unit":"in","required":false},{"key":"sleeve","label":"Sleeve","unit":"in","required":false}]'::jsonb, ARRAY['colour']::TEXT[], '[{"key":"abaya","label":"Abaya"},{"key":"burqa","label":"Burqa"},{"key":"niqab","label":"Niqab"},{"key":"hijab","label":"Hijab"},{"key":"other","label":"Other Islamic wear"}]'::jsonb, ARRAY['length','bust','waist','hip','shoulder']::TEXT[], NULL, 0),
  ('pt_trousers', 'trousers', 'Trousers and palazzos', ARRAY['colour','material','pattern','fit','waistRise','waistClosure','surfaceStyling','audience','occasion','care']::TEXT[], '[{"key":"length","label":"Length","unit":"in","required":true},{"key":"waist","label":"Waist","unit":"in","required":false}]'::jsonb, ARRAY['colour']::TEXT[], '[{"key":"trouser","label":"Trouser"},{"key":"palazzo","label":"Palazzo"},{"key":"salwar","label":"Salwar"}]'::jsonb, ARRAY['length','waist']::TEXT[], NULL, 1),
  ('pt_prayer_mat', 'prayer-mat', 'Prayer mat', ARRAY['colour','material','pattern','shape','care','packQuantity']::TEXT[], '[{"key":"length","label":"Length","unit":"cm","required":true},{"key":"width","label":"Width","unit":"cm","required":true}]'::jsonb, ARRAY['colour']::TEXT[], '[{"key":"mat","label":"Prayer mat"},{"key":"carpet","label":"Carpet"}]'::jsonb, ARRAY['length','width']::TEXT[], NULL, 2),
  ('pt_bag', 'bag', 'Bag', ARRAY['colour','material','pattern','closure','strap','compartments','waterResistant','audience','occasion']::TEXT[], '[{"key":"length","label":"Length","unit":"cm","required":true},{"key":"width","label":"Width","unit":"cm","required":true},{"key":"height","label":"Height","unit":"cm","required":true}]'::jsonb, ARRAY['colour']::TEXT[], '[{"key":"handbag","label":"Handbag"},{"key":"sling","label":"Sling bag"},{"key":"messenger","label":"Messenger bag"},{"key":"backpack","label":"Backpack"},{"key":"tote","label":"Tote"}]'::jsonb, ARRAY['length','width','height']::TEXT[], NULL, 3),
  ('pt_travel_pouch', 'travel-pouch', 'Travel pouch', ARRAY['colour','material','pattern','closure','audience','packQuantity']::TEXT[], '[{"key":"length","label":"Length","unit":"cm","required":true},{"key":"width","label":"Width","unit":"cm","required":true},{"key":"height","label":"Height","unit":"cm","required":false}]'::jsonb, ARRAY['colour']::TEXT[], '[{"key":"pouch","label":"Pouch"},{"key":"toiletry-kit","label":"Toiletry kit"}]'::jsonb, ARRAY['length','width','height']::TEXT[], NULL, 4),
  ('pt_fragrance', 'fragrance', 'Attar and bakhoor', ARRAY['scentFamily','shelfLifeMonths','packQuantity']::TEXT[], '[{"key":"capacity","label":"Capacity","unit":"ml","required":true}]'::jsonb, ARRAY['capacity']::TEXT[], '[{"key":"attar","label":"Attar"},{"key":"bakhoor","label":"Bakhoor"},{"key":"incense","label":"Incense"}]'::jsonb, ARRAY[]::TEXT[], NULL, 5),
  ('pt_jewellery', 'jewellery', 'Jewellery', ARRAY['colour','plating','baseMaterial','purity','gemstone','certification','occasion','audience']::TEXT[], '[{"key":"diameter","label":"Inner diameter","unit":"mm","required":true}]'::jsonb, ARRAY['plating','colour']::TEXT[], '[{"key":"ring","label":"Ring"},{"key":"ring-set","label":"Ring set"},{"key":"toe-ring","label":"Toe ring"}]'::jsonb, ARRAY['diameter']::TEXT[], '[{"value":14,"label":"6"},{"value":14.9,"label":"8"},{"value":15.7,"label":"10"},{"value":16.5,"label":"12"},{"value":17.3,"label":"14"},{"value":18.2,"label":"16"},{"value":19,"label":"18"},{"value":19.8,"label":"20"},{"value":20.6,"label":"22"}]'::jsonb, 6),
  ('pt_socks', 'socks', 'Socks', ARRAY['colour','material','pattern','audience','packQuantity']::TEXT[], '[{"key":"length","label":"Length","unit":"cm","required":false}]'::jsonb, ARRAY['colour','packQuantity']::TEXT[], '[{"key":"ankle","label":"Ankle length"},{"key":"crew","label":"Crew"},{"key":"knee-high","label":"Knee high"},{"key":"no-show","label":"No show"}]'::jsonb, ARRAY['length']::TEXT[], NULL, 7),
  ('pt_combo', 'combo', 'Gift set or combo', ARRAY['contents','colour','occasion','packQuantity']::TEXT[], '[]'::jsonb, ARRAY['colour']::TEXT[], '[{"key":"prayer-set","label":"Prayer set"},{"key":"gift-set","label":"Gift set"}]'::jsonb, ARRAY[]::TEXT[], NULL, 8)
) AS v(id, key, label, facts, measures, axis, kinds, lf, ls, ord)
ON CONFLICT ("key") DO NOTHING;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_productType_fkey" FOREIGN KEY ("productType") REFERENCES "ProductType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_productType_fkey" FOREIGN KEY ("productType") REFERENCES "ProductType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
