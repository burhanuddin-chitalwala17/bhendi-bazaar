/**
 * GET /api/org/[orgId]/shipments/[id]/label — the shop's "Download label" (order-fulfilment D7, Q26).
 * Streams the stored link, so the raw link — and the address on it — never reaches the shop.
 */
import { withOrg } from "@/lib/org-auth";
import { labelLinkFor } from "@server/checkout/fulfilment-booking";
import { fetchLabel } from "@server/shipping/label";
import { DomainError } from "@server/shared/domain-error";

export const GET = withOrg<{ orgId: string; id: string }>(async (_request, scope, params) => {
  const { link, code } = await labelLinkFor(params.id, scope.orgId);
  const upstream = await fetchLabel(link);
  if (!upstream?.body) throw new DomainError("Couldn't fetch the label. Try again in a minute.", { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition": `attachment; filename="${code.replace(/[^\w-]/g, "")}-label.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
