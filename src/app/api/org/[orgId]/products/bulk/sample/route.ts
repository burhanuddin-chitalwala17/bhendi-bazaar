/**
 * The org's own template (R7): stock columns are its real pickup locations,
 * category examples are current slugs. Generated per request, never stored (D7).
 */
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { buildProductSampleSheet } from "@server/catalog/bulk/sample-sheet";
import { categoryRepository } from "@server/catalog/category.repository";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { orgRepository } from "@server/catalog/org.repository";

export const GET = withOrg<{ orgId: string }>(async (_request, scope) => {
  try {
    const [org, locations, categories] = await Promise.all([
      orgRepository.findById(scope.orgId),
      orgAddressRepository.listByOrg(scope.orgId),
      categoryRepository.list(),
    ]);
    const buffer = await buildProductSampleSheet({
      orgName: org?.name ?? "org",
      locationNames: locations.filter((l) => l.isActive !== false).map((l) => l.name),
      categorySlugs: categories.map((c) => c.slug),
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="bulk-products-sample.xlsx"',
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not build the sample sheet");
  }
});
