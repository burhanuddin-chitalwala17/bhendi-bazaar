"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OrgForm } from "@/components/shared/forms/orgs";
import { orgsApiClient } from "@/components/org/orgsApiClient";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";

/**
 * The same form the platform admin uses, given a different destination. Field errors
 * from the server — a taken code, an invalid pincode — land on their inputs through
 * `useServerForm` inside `OrgForm`, so there is no error handling here.
 */
export function CreateOrg() {
  const router = useRouter();

  const submit = async (data: OrgFormInput) => {
    const org = await orgsApiClient.create(data);
    toast.success("Organisation created");
    router.push(`/org/${org.id}`);
    router.refresh();
  };

  return <OrgForm onSubmit={submit} onCancel={() => router.push("/org")} />;
}
