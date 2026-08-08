-- category-tree: categories nest via a self-referencing parent. Every existing
-- category becomes a root (parentId NULL); no data moves.
--
-- Also the day Product.categoryId stops cascading: deleting a category would have
-- deleted its products, with only an application-level count in the way (D3).

ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Product" DROP CONSTRAINT "Product_categoryId_fkey";
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
