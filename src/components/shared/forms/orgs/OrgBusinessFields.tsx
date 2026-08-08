// src/components/shared/forms/org/OrgBusinessFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput, FormTextarea } from "@/components/shared/forms/FormField";
import { Building2 } from "lucide-react";

interface OrgBusinessFieldsProps {
  register: UseFormRegister<OrgFormInput>;
  errors: FieldErrors<OrgFormInput>;
  readOnly?: boolean;
}

export function OrgBusinessFields({
  register,
  errors,
  readOnly = false,
}: OrgBusinessFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Business Details (Optional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormInput
          label="Business Name"
          error={errors.businessName?.message}
          disabled={readOnly}
          placeholder="ABC Traders Pvt Ltd"
          {...register("businessName")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="GST Number"
            error={errors.gstNumber?.message}
            disabled={readOnly}
            placeholder="27AABCU9603R1ZM"
            maxLength={15}
            className="uppercase"
            hint="15-digit GSTIN (optional)"
            {...register("gstNumber")}
          />

          <FormInput
            label="PAN Number"
            error={errors.panNumber?.message}
            disabled={readOnly}
            placeholder="ABCDE1234F"
            maxLength={10}
            className="uppercase"
            hint="10-character PAN (optional)"
            {...register("panNumber")}
          />
        </div>

        <FormTextarea
          label="Description"
          error={errors.description?.message}
          disabled={readOnly}
          placeholder="Brief description about the org..."
          rows={3}
          {...register("description")}
        />
      </CardContent>
    </Card>
  );
}