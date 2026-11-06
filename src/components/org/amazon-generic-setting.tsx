"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation } from "@/hooks/core/useMutation";

import { orgListingDefaultsApiClient } from "./orgListingDefaultsApiClient";
import { AMAZON_GENERIC_COPY as C } from "./org-copy";

/** "My brand isn't registered on Amazon: list as Generic" (setup-requests Q35). Saves as it is switched. */
export function AmazonGenericSetting({ orgId, initial }: { orgId: string; initial: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const save = useMutation((value: boolean) => orgListingDefaultsApiClient.setAmazonGeneric(orgId, value), { showToast: false });

  const change = (value: boolean) => {
    setOn(value);
    save
      .mutate(value)
      .then(() => {
        toast.success(value ? C.on : C.off);
        router.refresh();
      })
      .catch(() => {
        setOn(!value);
        toast.error(C.failed);
      });
  };

  return (
    <div className="flex flex-col gap-2 rounded-card border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <Label htmlFor="amazon-generic" className="text-body font-medium">{C.label}</Label>
        <Switch id="amazon-generic" checked={on} onCheckedChange={change} />
      </div>
      <p className="text-small text-muted-foreground">{C.body}</p>
    </div>
  );
}
