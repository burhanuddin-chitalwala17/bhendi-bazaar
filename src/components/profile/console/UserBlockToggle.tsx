"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@/hooks/core/useMutation";
import { adminUserApiClient } from "@/components/profile/console/adminUserApiClient";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { USER_BLOCK_TOGGLE_COPY } from "./console-copy";

interface Props {
  userId: string;
  isBlocked: boolean;
}

export function UserBlockToggle({ userId, isBlocked }: Props) {
  const router = useRouter();

  const { mutate: toggle, isLoading } = useMutation(
    () => adminUserApiClient.toggleBlockUser(userId, !isBlocked),
    {
      successMessage: isBlocked ? USER_BLOCK_TOGGLE_COPY.userUnblocked : USER_BLOCK_TOGGLE_COPY.userBlocked,
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <Button
      variant={isBlocked ? "outline" : "destructive"}
      size="sm"
      onClick={() => toggle()}
      pending={isLoading}
      className="w-full"
    >
      {isBlocked ? (
        <>
          <Icon name="secure" />{USER_BLOCK_TOGGLE_COPY.unblockUser}</>
      ) : (
        <>
          <Icon name="block" />{USER_BLOCK_TOGGLE_COPY.blockUser}</>
      )}
    </Button>
  );
}
