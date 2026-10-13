"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@/hooks/core/useMutation";
import { adminUserApiClient } from "@/components/profile/console/adminUserApiClient";
import { Button } from "@/components/ui/button";
import { Ban, ShieldOff } from "lucide-react";

interface Props {
  userId: string;
  isBlocked: boolean;
}

export function UserBlockToggle({ userId, isBlocked }: Props) {
  const router = useRouter();

  const { mutate: toggle, isLoading } = useMutation(
    () => adminUserApiClient.toggleBlockUser(userId, !isBlocked),
    {
      successMessage: isBlocked ? "User unblocked" : "User blocked",
      onSuccess: () => router.refresh(),
    },
  );

  return (
    <Button
      variant={isBlocked ? "outline" : "destructive"}
      size="sm"
      onClick={() => toggle()}
      disabled={isLoading}
      className="w-full"
    >
      {isBlocked ? (
        <>
          <ShieldOff className="mr-2 h-4 w-4" />
          Unblock User
        </>
      ) : (
        <>
          <Ban className="mr-2 h-4 w-4" />
          Block User
        </>
      )}
    </Button>
  );
}
