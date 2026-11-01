/**
 * The download half of the bulk sheet (own-store/bulk-sheet D1): what the page offers to tick,
 * and the workbook those ticks make.
 */
import { brandService } from "@server/catalog/brand.service";
import { categoryRepository } from "@server/catalog/category.read.repository";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { orgRepository } from "@server/catalog/org.repository";
import { adminProductsRepository } from "@server/catalog/product.repository";
import { FACT_DECLARATIONS } from "@server/listing/listing-facts";
import { listingValueRepository } from "@server/listing/listing-value.repository";
import { productFamilyService } from "@server/listing/product-family.service";
import { productTypeRepository } from "@server/listing/product-type.repository";

import { buildProductSampleSheet } from "./sample-sheet";
import { categoryPaths, groupForTicking, planSheetTabs, type TickGroup } from "./sheet-tabs";

export interface SheetChoicesDTO {
  groups: TickGroup[];
  /** The categories the shop already sells in, ticked on arrival (Q2). */
  soldIds: string[];
  hasLocation: boolean;
}

async function activeLocationNames(orgId: string): Promise<string[]> {
  const locations = await orgAddressRepository.listByOrg(orgId);
  return locations.filter((l) => l.isActive !== false).map((l) => l.name);
}

export const bulkSheetService = {
  async choices(orgId: string): Promise<SheetChoicesDTO> {
    const [categories, tree, types, sold, locations] = await Promise.all([
      categoryRepository.list(),
      categoryRepository.listTree(),
      productTypeRepository.list(),
      adminProductsRepository.listCategoriesSoldBy(orgId),
      activeLocationNames(orgId),
    ]);
    const typeOf = new Map(tree.map((node) => [node.id, node.productType]));
    const tickable = categories.map((c) => ({ id: c.id, parentId: c.parentId, slug: c.slug, name: c.name, productType: typeOf.get(c.id) ?? null }));
    return {
      groups: groupForTicking(tickable, types),
      soldIds: sold.map((category) => category.id),
      hasLocation: locations.length > 0,
    };
  },

  async buildSheet(orgId: string, tickedIds: string[]): Promise<Buffer> {
    const [org, locationNames, categories, named, types, families, brands] = await Promise.all([
      orgRepository.findById(orgId),
      activeLocationNames(orgId),
      categoryRepository.listTree(),
      categoryRepository.list(),
      productTypeRepository.list(),
      productFamilyService.list(orgId),
      brandService.list(orgId),
    ]);
    const paths = categoryPaths(named);
    const tabs = planSheetTabs(tickedIds, categories, types);
    // Only the lists these tabs ask about: there are a thousand values and a sheet needs a few.
    const lists = [
      ...new Set(
        tabs.flatMap((tab) =>
          (tab.type?.facts ?? []).map((fact) => FACT_DECLARATIONS[fact]?.list).filter((l): l is string => !!l),
        ),
      ),
    ];
    const values = await listingValueRepository.byLists(lists, orgId);
    return buildProductSampleSheet({
      orgName: org?.name ?? "your shop",
      madeOn: new Date(),
      locationNames,
      tabs,
      values,
      categoryPaths: Object.fromEntries(named.map((category) => [category.slug, paths.get(category.id)!])),
      families: families.map((family) => family.name),
      brands: brands.map((brand) => brand.name),
    });
  },
};
