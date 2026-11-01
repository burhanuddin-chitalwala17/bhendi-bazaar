import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation } from "@/hooks/core/useMutation";
import { useShare } from "@/hooks/core/useShare";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";
import { doneToast } from "@/components/org/home/home-copy";
import { setupApiClient } from "@/components/org/home/setupApiClient";
import { SHARE_COPY } from "./share-copy";

/** Where the shop stands on setup step 5; null where the page does not read it (the Shop tab). */
export interface ShareSetup {
  shared: boolean;
  doneCount: number;
}

export const COPY_STATE = { IDLE: "idle", COPIED: "copied", FAILED: "failed" } as const;
export type CopyState = (typeof COPY_STATE)[keyof typeof COPY_STATE];

/**
 * A share or a copy, and the shop's first one recorded (own-store onboarding D13, Q3). The record
 * is marked only once the server has it: a failed one is silent and the next tap tries again.
 */
export function useShareShop(orgId: string, url: string, setup: ShareSetup | null) {
  const router = useRouter();
  const { copyToClipboard } = useShare();
  const recorded = useRef(false);
  const [copyState, setCopyState] = useState<CopyState>(COPY_STATE.IDLE);
  const { mutate: markShared } = useMutation(() => setupApiClient.markShared(orgId), { showToast: false });

  /** True when this tap was the shop's first recorded share. */
  const record = async (): Promise<boolean> => {
    // The prop as well as the ref: a sheet that stayed mounted across a refresh learns it from props.
    if (recorded.current || setup?.shared) return false;
    try {
      await markShared();
    } catch {
      return false;
    }
    recorded.current = true;
    router.refresh();
    return true;
  };

  const shareOnWhatsApp = async () => {
    const first = await record();
    toast.success(first && setup ? doneToast(ONBOARDING_STEP.SHARE, setup.doneCount + 1) : SHARE_COPY.shared);
  };

  const copyLink = async () => {
    const ok = await copyToClipboard(url);
    setCopyState(ok ? COPY_STATE.COPIED : COPY_STATE.FAILED);
    if (!ok) return;
    toast.success(SHARE_COPY.copied);
    await record();
  };

  return { shareOnWhatsApp, copyLink, copyState };
}
