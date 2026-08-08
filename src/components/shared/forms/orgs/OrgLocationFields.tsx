// src/components/shared/forms/org/OrgLocationFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput, FormTextarea } from "@/components/shared/forms/FormField";
import { MapPin } from "lucide-react";

interface OrgLocationFieldsProps {
  register: UseFormRegister<OrgFormInput>;
  errors: FieldErrors<OrgFormInput>;
  readOnly?: boolean;
}

export function OrgLocationFields({
  register,
  errors,
  readOnly = false,
}: OrgLocationFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Pickup Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormTextarea
          label="Address"
          error={errors.defaultAddress?.message}
          disabled={readOnly}
          placeholder="Street address, building name"
          rows={2}
          {...register("defaultAddress")}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="City"
            required
            error={errors.defaultCity?.message}
            disabled={readOnly}
            placeholder="Bangalore"
            {...register("defaultCity")}
          />

          <FormInput
            label="State"
            required
            error={errors.defaultState?.message}
            disabled={readOnly}
            placeholder="Karnataka"
            {...register("defaultState")}
          />

          <FormInput
            label="Pincode"
            required
            error={errors.defaultPincode?.message}
            disabled={readOnly}
            placeholder="560083"
            maxLength={6}
            {...register("defaultPincode")}
          />
        </div>
      </CardContent>
    </Card>
  );
}