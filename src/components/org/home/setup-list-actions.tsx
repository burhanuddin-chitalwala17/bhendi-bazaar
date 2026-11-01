"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import { setupApiClient } from "./setupApiClient";
import { HOME_COPY } from "./home-copy";

/** "Hide for now" (Q6, A6): per shop, with "Undo" in the toast. */
export function HideSetupButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { mutate: show } = useMutation(() => setupApiClient.show(orgId), { onSuccess: () => router.refresh() });
  const { mutate: hide, isLoading } = useMutation(() => setupApiClient.hide(orgId), {
    onSuccess: () => {
      toast(HOME_COPY.hidden, { action: { label: HOME_COPY.undo, onClick: () => void show().catch(() => {}) } });
      router.refresh();
    },
  });
  return (
    <Button variant="ghost" size="sm" className="min-h-11" aria-busy={isLoading} onClick={() => void hide().catch(() => {})}>
      {HOME_COPY.hide}
    </Button>
  );
}

/** The hidden list's one line, where More → "Setup list" lands (A6). */
export function ShowSetupButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const { mutate: show, isLoading } = useMutation(() => setupApiClient.show(orgId), { onSuccess: () => router.refresh() });
  return (
    <Button variant="outline" size="sm" className="min-h-11" aria-busy={isLoading} onClick={() => void show().catch(() => {})}>
      {HOME_COPY.show}
    </Button>
  );
}
