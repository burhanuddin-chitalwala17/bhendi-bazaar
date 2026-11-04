"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@/hooks/core/useMutation";
import { orgApiClient } from "@/components/org/console/orgApiClient";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ORG_CONSOLE_COPY } from "./org-console-copy";

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
      successMessage: isBlocked ? ORG_CONSOLE_COPY.unblocked : ORG_CONSOLE_COPY.blocked,
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
          {ORG_CONSOLE_COPY.unblock}
        </>
      ) : (
        <>
          <Icon name="block" />
          {ORG_CONSOLE_COPY.block}
        </>
      )}
    </Button>
  );
}
