"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@/hooks/core/useMutation";
import { orgApiClient } from "@/components/org/console/orgApiClient";
import { Button } from "@/components/ui/button";
import { Ban, ShieldOff } from "lucide-react";

interface Props {
  orgId: string;
  isBlocked: boolean;
}

export function OrgBlockToggle({ orgId, isBlocked }: Props) {
  const router = useRouter();

  const { mutate: toggle, isLoading } = useMutation(
    () =>
      isBlocked
        ? orgApiClient.unblockOrg(orgId)
        : orgApiClient.blockOrg(orgId),
    {
      successMessage: isBlocked ? "Organisation unblocked" : "Organisation blocked",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <Button
      variant={isBlocked ? "outline" : "destructive"}
      size="sm"
      onClick={() => toggle()}
      disabled={isLoading}
    >
      {isBlocked ? (
        <>
          <ShieldOff className="mr-1 h-3.5 w-3.5" />
          Unblock
        </>
      ) : (
        <>
          <Ban className="mr-1 h-3.5 w-3.5" />
          Block
        </>
      )}
    </Button>
  );
}
