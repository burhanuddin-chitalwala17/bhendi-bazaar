"use client";

import { useRouter } from "next/navigation";

import { useMutation } from "@/hooks/core/useMutation";
import { pickupsApiClient } from "./pickupsApiClient";
import { toast } from "sonner";

/** "Email shop" on a not-packed row; the toast is the server's "Email sent to {shop}." */
export function useEmailShop(shipmentId: string) {
  const router = useRouter();
  const { mutate, isLoading } = useMutation(() => pickupsApiClient.emailShop(shipmentId), {
    onSuccess: ({ message }) => {
      toast.success(message);
      router.refresh();
    },
  });
  return { send: () => (isLoading ? undefined : mutate().catch(() => undefined)), sending: isLoading };
}
