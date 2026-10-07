"use client";

import { useRouter } from "next/navigation";
import { Package } from "lucide-react";
import { useMutation } from "@/hooks/core/useMutation";
import { orgOrdersApiClient } from "@/components/org/orgOrdersApiClient";
import { Button } from "@/components/ui/button";

interface Props {
  orgId: string;
  orderId: string;
}

export function OrgOrderPackButton({ orgId, orderId }: Props) {
  const router = useRouter();

  const { mutate: markPacked, isLoading } = useMutation(
    () => orgOrdersApiClient.transitionOrder(orgId, orderId, "packed"),
    {
      successMessage: "Order marked as packed",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <Button onClick={() => markPacked()} disabled={isLoading}>
      <Package className="mr-2 h-4 w-4" />
      {isLoading ? "Updating…" : "Mark as Packed"}
    </Button>
  );
}
