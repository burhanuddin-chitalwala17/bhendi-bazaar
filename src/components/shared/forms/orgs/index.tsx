import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  orgFormSchema,
  type OrgFormInput,
} from "@/lib/validation/schemas/org.schema";
import type { Org } from "@/domain/org";
import { OrgBasicFields } from "./OrgBasicFields";
import { OrgBusinessFields } from "./OrgBusinessFields";
import { FormActions } from "../../button-groups/FormActions";

interface OrgFormProps {
  org?: Org;
  onSubmit: (data: OrgFormInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

export function OrgForm({
  org,
  onSubmit,
  onCancel,
  isSubmitting,
  readOnly = false,
}: OrgFormProps) {
  const isEdit = !!org;

  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    watch,
    setValue,
    formState: { errors },
  } = useServerForm<OrgFormInput>({
    schema: orgFormSchema,
    submit: onSubmit,
    defaultValues: {
      name: org?.name || "",
      email: org?.email || "",
      phone: org?.phone || "",
      contactPerson: org?.contactPerson || "",
      businessName: org?.businessName || "",
      gstNumber: org?.gstNumber || "",
      panNumber: org?.panNumber || "",
      isActive: org?.isActive,
      description: org?.description || "",
    },
  });

  const isActive = watch("isActive");

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      {/* Basic Information */}
      <OrgBasicFields
        register={register}
        errors={errors}
        code={org?.code}
        readOnly={readOnly}
      />

      {/* Business Details */}
      <OrgBusinessFields
        register={register}
        errors={errors}
        readOnly={readOnly}
      />

      {/* Status — deactivation is an act on an existing org, so create has no switch */}
      {isEdit && !readOnly && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive orgs cannot list new products
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {readOnly ? (
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Close
          </Button>
        </div>
      ) : (
        <FormActions
          onCancel={onCancel}
          submitLabel={isEdit ? "Update Organisation" : "Create Organisation"}
          isSubmitting={isSubmitting}
        />
      )}
    </form>
  );
}
