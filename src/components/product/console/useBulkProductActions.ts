"use client";

import { useParams, usePathname, useRouter } from "next/navigation";

import { useMutation } from "@/hooks/core/useMutation";
import type { BulkProductActionInput, TeamBulkProductActionInput } from "@/lib/validation/schemas/product-bulk.schema";
import { BULK_ACTION } from "@server/catalog/product-bulk.types";
import { ProductsApiClient } from "./productsApiClient";
import { ROUTES } from "@server/shared/routes";

/**
 * A bulk action on the selected products (design-system Q29): one request per action, whatever the
 * selection's size. Under /org the shop's own route; under /admin the team's, with its reason. The
 * result says what changed, what was left and why, and which stock rows moved under the editor;
 * the caller shows it. A double tap with the same selection is one request (`useMutation`).
 */
export function useBulkProductActions() {
  const router = useRouter();
  const params = useParams();
  const orgId = typeof params.orgId === "string" ? params.orgId : undefined;
  const team = !!usePathname()?.startsWith(`${ROUTES.admin.home}/`);
  const client = new ProductsApiClient(orgId, team);

  const { mutate, isLoading, data, error, reset } = useMutation(
    (input: { action: BulkProductActionInput; reason?: string }) =>
      team ? client.teamBulkEdit(teamBody(input.action, input.reason ?? "")) : client.bulkEdit(input.action),
    { onSuccess: () => router.refresh() },
  );

  // A failure is already said (toast) and kept in `error`; the caller gets null and stays open.
  const run = (input: { action: BulkProductActionInput; reason?: string }) => mutate(input).catch(() => null);

  return { run, running: isLoading, result: data, error, clear: reset, team };
}

/** The team names its products; "all that match" is the shop's own list (Q35), so it never reaches here. */
function teamBody(action: BulkProductActionInput, reason: string): TeamBulkProductActionInput {
  if (action.action === BULK_ACTION.STOCK) return { ...action, reason };
  const { matching, productIds, ...rest } = action;
  if (matching || !productIds) throw new Error("The team acts on the products it picked");
  return { ...rest, productIds, reason };
}
