// src/components/shared/forms/org/OrgBusinessFields.tsx

import { UseFormRegister, FieldErrors } from "react-hook-form";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput, FormTextarea } from "@/components/shared/forms/FormField";
import { Icon } from "@/components/ui/icon";
import { ORG_BUSINESS_FIELDS_COPY } from "./orgs-copy";

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
          <Icon name="organisation" size="md" />
          {ORG_BUSINESS_FIELDS_COPY.businessDetailsOptional}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormInput
          label={ORG_BUSINESS_FIELDS_COPY.businessName}
          error={errors.businessName?.message}
          disabled={readOnly}
          placeholder={ORG_BUSINESS_FIELDS_COPY.abcTradersPvtLtd}
          {...register("businessName")}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label={ORG_BUSINESS_FIELDS_COPY.gstNumber}
            error={errors.gstNumber?.message}
            disabled={readOnly}
            placeholder="27AABCU9603R1ZM"
            maxLength={15}
            className="uppercase"
            hint={ORG_BUSINESS_FIELDS_COPY.t15DigitGstinOptional}
            {...register("gstNumber")}
          />

          <FormInput
            label={ORG_BUSINESS_FIELDS_COPY.panNumber}
            error={errors.panNumber?.message}
            disabled={readOnly}
            placeholder="ABCDE1234F"
            maxLength={10}
            className="uppercase"
            hint={ORG_BUSINESS_FIELDS_COPY.t10CharacterPanOptional}
            {...register("panNumber")}
          />
        </div>

        <FormTextarea
          label={ORG_BUSINESS_FIELDS_COPY.description}
          error={errors.description?.message}
          disabled={readOnly}
          placeholder={ORG_BUSINESS_FIELDS_COPY.briefDescriptionAboutTheOrg}
          rows={3}
          {...register("description")}
        />
      </CardContent>
    </Card>
  );
}
