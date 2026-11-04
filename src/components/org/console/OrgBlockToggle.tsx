"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@/hooks/core/useMutation";
import { orgApiClient } from "@/components/org/console/orgApiClient";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

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
      successMessage: isBlocked ? "Shop unblocked" : "Shop blocked",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <Button
      variant={isBlocked ? "outline" : "destructive"}
      size="sm"
      onClick={() => toggle()}
      pending={isLoading}
    >
      {isBlocked ? (
        <>
          <Icon name="secure" />
          Unblock
        </>
      ) : (
        <>
          <Icon name="block" />
          Block
        </>
      )}
    </Button>
  );
}
