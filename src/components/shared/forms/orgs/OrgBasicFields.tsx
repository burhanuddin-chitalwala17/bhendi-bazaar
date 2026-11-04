// src/components/shared/forms/org/OrgBasicFields.tsx

import { Control, UseFormRegister, FieldErrors } from "react-hook-form";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormInput, FormPhoneInput } from "@/components/shared/forms/FormField";
import { Icon } from "@/components/ui/icon";
import { ORG_BASIC_FIELDS_COPY } from "./orgs-copy";

interface OrgBasicFieldsProps {
  register: UseFormRegister<OrgFormInput>;
  control: Control<OrgFormInput>;
  errors: FieldErrors<OrgFormInput>;
  /** Shown read-only on an existing org. Absent on create: codes are server-generated. */
  code?: string;
  readOnly?: boolean;
}

export function OrgBasicFields({
  register,
  control,
  errors,
  code,
  readOnly = false,
}: OrgBasicFieldsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="shop" size="md" />
          {ORG_BASIC_FIELDS_COPY.basicInformation}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {code && (
            <FormInput
              label={ORG_BASIC_FIELDS_COPY.organisationCode}
              value={code}
              disabled
              readOnly
              hint={ORG_BASIC_FIELDS_COPY.assignedAutomaticallyCodesNeverChange}
            />
          )}

          <FormInput
            label={ORG_BASIC_FIELDS_COPY.organisationName}
            required
            error={errors.name?.message}
            disabled={readOnly}
            placeholder={ORG_BASIC_FIELDS_COPY.abcTraders}
            {...register("name")}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label={ORG_BASIC_FIELDS_COPY.email}
            required
            type="email"
            error={errors.email?.message}
            disabled={readOnly}
            placeholder={ORG_BASIC_FIELDS_COPY.orgExampleCom}
            {...register("email")}
          />

          <FormPhoneInput
            name="phone"
            control={control}
            label={ORG_BASIC_FIELDS_COPY.phone}
            disabled={readOnly}
            placeholder="98765 43210"
          />
        </div>

        <FormInput
          label={ORG_BASIC_FIELDS_COPY.contactPerson}
          error={errors.contactPerson?.message}
          disabled={readOnly}
          placeholder={ORG_BASIC_FIELDS_COPY.johnDoe}
          {...register("contactPerson")}
        />
      </CardContent>
    </Card>
  );
}
