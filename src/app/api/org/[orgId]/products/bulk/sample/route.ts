/**
 * The org's own template (R7), built per request and never stored (D7).
 *
 * Everything in it is read now: its stock columns are the org's real pickup locations, its
 * category examples are current slugs, and since the listing vocabulary its question columns and
 * dropdowns are the product types and permitted answers that exist at this moment. Adding a type
 * or a colour changes the next download with nothing to edit.
 *
 * `?types=a,b` narrows it to the types an org is actually uploading — Amazon's shape, one
 * workbook for several. Omitted, it spans every live type.
 */
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { buildProductSampleSheet } from "@server/catalog/bulk/sample-sheet";
import { categoryRepository } from "@server/catalog/category.repository";
import { FACT_DECLARATIONS } from "@server/listing/listing-facts";
import { listingValueRepository } from "@server/listing/listing-value.repository";
import { productTypeRepository } from "@server/listing/product-type.repository";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { orgRepository } from "@server/catalog/org.repository";

export const GET = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const wanted = (request.nextUrl.searchParams.get("types") ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean);

    const [org, locations, categories, allTypes] = await Promise.all([
      orgRepository.findById(scope.orgId),
      orgAddressRepository.listByOrg(scope.orgId),
      categoryRepository.list(),
      productTypeRepository.list(),
    ]);

    const productTypes = wanted.length
      ? allTypes.filter((type) => wanted.includes(type.key))
      : allTypes;

    // Only the lists these types ask about: there are a thousand values and a sheet needs the
    // few that become its dropdowns.
    const lists = [
      ...new Set(
        productTypes.flatMap((type) =>
          type.facts.map((fact) => FACT_DECLARATIONS[fact]?.list).filter((l): l is string => !!l),
        ),
      ),
    ];
    const values = await listingValueRepository.byLists(lists, scope.orgId);
    const buffer = await buildProductSampleSheet({
      orgName: org?.name ?? "org",
      locationNames: locations
        .filter((l) => l.isActive !== false)
        .map((l) => l.name),
      categorySlugs: categories.map((c) => c.slug),
      productTypes,
      values,
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="bulk-products-sample.xlsx"',
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not build the sample sheet");
  }
});
