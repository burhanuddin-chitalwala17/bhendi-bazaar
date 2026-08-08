// src/components/shared/forms/org/OrgBasicFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput } from "@/components/shared/forms/FormField";
import { Store } from "lucide-react";

interface OrgBasicFieldsProps {
  register: UseFormRegister<OrgFormInput>;
  errors: FieldErrors<OrgFormInput>;
  /** Shown read-only on an existing org. Absent on create: codes are server-generated. */
  code?: string;
  readOnly?: boolean;
}

export function OrgBasicFields({
  register,
  errors,
  code,
  readOnly = false,
}: OrgBasicFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Basic Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{code && (
            <FormInput
              label="Organisation Code"
              value={code}
              disabled
              readOnly
              hint="Assigned automatically — codes never change"
            />
          )}

          <FormInput
            label="Organisation Name"
            required
            error={errors.name?.message}
            disabled={readOnly}
            placeholder="ABC Traders"
            {...register("name")}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Email"
            required
            type="email"
            error={errors.email?.message}
            disabled={readOnly}
            placeholder="org@example.com"
            {...register("email")}
          />

          <FormInput
            label="Phone"
            error={errors.phone?.message}
            disabled={readOnly}
            placeholder="+91 98765 43210"
            {...register("phone")}
          />
        </div>

        <FormInput
          label="Contact Person"
          error={errors.contactPerson?.message}
          disabled={readOnly}
          placeholder="John Doe"
          {...register("contactPerson")}
        />
      </CardContent>
    </Card>
  );
}