import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  createSellerSchema,
  type CreateSellerInput,
} from "@/lib/validation/schemas/seller.schema";
import type { Seller } from "@/domain/seller";
import { SellerBasicFields } from "./SellerBasicFields";
import { SellerLocationFields } from "./SellerLocationFields";
import { SellerBusinessFields } from "./SellerBusinessFields";
import { FormActions } from "../../button-groups/FormActions";

interface SellerFormProps {
  seller?: Seller;
  onSubmit: (data: CreateSellerInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

export function SellerForm({
  seller,
  onSubmit,
  onCancel,
  isSubmitting,
  readOnly = false,
}: SellerFormProps) {
  const isEdit = !!seller;

  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    watch,
    setValue,
    formState: { errors },
  } = useServerForm<CreateSellerInput>({
    schema: createSellerSchema,
    submit: onSubmit,
    defaultValues: {
      code: seller?.code || "",
      name: seller?.name || "",
      email: seller?.email || "",
      phone: seller?.phone || "",
      contactPerson: seller?.contactPerson || "",
      defaultPincode: seller?.defaultPincode || "",
      defaultCity: seller?.defaultCity || "",
      defaultState: seller?.defaultState || "",
      defaultAddress: seller?.defaultAddress || "",
      businessName: seller?.businessName || "",
      gstNumber: seller?.gstNumber || "",
      panNumber: seller?.panNumber || "",
      isActive: seller?.isActive ?? true,
      description: seller?.description || "",
    },
  });

  const isActive = watch("isActive");

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      {/* Basic Information */}
      <SellerBasicFields
        register={register}
        errors={errors}
        isEdit={isEdit}
        readOnly={readOnly}
      />

      {/* Shipping Location */}
      <SellerLocationFields
        register={register}
        errors={errors}
        readOnly={readOnly}
      />

      {/* Business Details */}
      <SellerBusinessFields
        register={register}
        errors={errors}
        readOnly={readOnly}
      />

      {/* Status */}
      {!readOnly && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive sellers cannot list new products
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
          submitLabel={isEdit ? "Update Seller" : "Create Seller"}
          isSubmitting={isSubmitting}
        />
      )}
    </form>
  );
}
