/**
 * Create every product from a validated sheet — all-or-nothing (R3). The payload
 * is re-validated in full: validate-then-create is two requests, and nothing
 * stops a client editing the rows in between (Invariant 4).
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { bulkProductCreateSchema, createRowsOf } from "@/lib/validation/schemas/bulk-product.schema";
import { createProducts, validateCreateRows } from "@server/catalog/bulk/bulk-product.service";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const parsed = bulkProductCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new DomainError(
        parsed.error.issues[0]?.message ?? "Invalid payload",
      );
    }

    const rows = createRowsOf(parsed.data.rows);

    // Same checks as the dry run; every named image must have an uploaded URL.
    const errors = await validateCreateRows(scope.orgId, rows);
    if (errors.length) {
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }

    // The member is the editor, so a team mark on an updated product clears (own-store/bulk-sheet D10).
    const { created, updated } = await createProducts(scope.orgId, rows, { userId: scope.userId, team: false });
    return NextResponse.json({ ok: true, created, updated });
  } catch (error) {
    return toErrorResponse(error, "Could not create the products");
  }
});
