"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";

import { adminRequestsApiClient } from "./adminRequestsApiClient";
import { REQUESTS_COPY as C } from "./requests-copy";

/** An issue's one action (setup-requests Q22): the developer marks it fixed; the same error later reopens it. */
export function MarkFixedButton({ id }: { id: string }) {
  const router = useRouter();
  const act = useMutation(() => adminRequestsApiClient.act(id, { action: "mark_fixed" }), { showToast: false, onError: (e) => toast.error(e.message) });
  return (
    <Button
      className="min-h-10 w-full md:w-auto"
      pending={act.isLoading}
      onClick={() => act.mutate().then(() => { toast.success(C.markedFixed); router.refresh(); }).catch(() => undefined)}
    >
      {C.markFixed}
    </Button>
  );
}
