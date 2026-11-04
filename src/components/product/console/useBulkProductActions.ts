"use client";

import { useParams, usePathname, useRouter } from "next/navigation";

import { useMutation } from "@/hooks/core/useMutation";
import type { BulkProductActionInput } from "@/lib/validation/schemas/product-bulk.schema";
import { ProductsApiClient } from "./productsApiClient";

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
  const team = !!usePathname()?.startsWith("/admin/");
  const client = new ProductsApiClient(orgId, team);

  const { mutate, isLoading, data, error, reset } = useMutation(
    (input: { action: BulkProductActionInput; reason?: string }) =>
      team ? client.teamBulkEdit({ ...input.action, reason: input.reason ?? "" }) : client.bulkEdit(input.action),
    { onSuccess: () => router.refresh() },
  );

  // A failure is already said (toast) and kept in `error`; the caller gets null and stays open.
  const run = (input: { action: BulkProductActionInput; reason?: string }) => mutate(input).catch(() => null);

  return { run, running: isLoading, result: data, error, clear: reset, team };
}
