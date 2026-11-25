"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@/hooks/core/useMutation";
import { notificationsApiClient } from "./notificationsApiClient";
import { NOTIFICATIONS_UI_COPY } from "./notifications-copy";

/** The morning-email switch, saved as switched (ux journey 4); a failed save puts it back. */
export function useMorningEmail(orgId: string, initial: boolean) {
  const [on, setOn] = useState(initial);
  const save = useMutation((next: boolean) => notificationsApiClient.savePrefs(orgId, { morningEmail: next }), {
    onSuccess: (saved) => {
      toast.success(saved.morningEmail ? NOTIFICATIONS_UI_COPY.settings.on : NOTIFICATIONS_UI_COPY.settings.off);
    },
  });
  const toggle = (next: boolean) => {
    setOn(next);
    save.mutate(next).catch(() => setOn(!next));
  };
  return { on, toggle, saving: save.isLoading };
}
