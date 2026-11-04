"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormController, FormInput } from "@/components/shared/forms/FormField";
import { CountryPicker } from "@/components/shared/forms/CountryPicker";
import { asCountryCode, countryName } from "@server/shared/countries";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { useServerForm } from "@/hooks/core/useServerForm";
import { useMutation } from "@/hooks/core/useMutation";
import { orgBrandsApiClient } from "@/components/org/orgBrandsApiClient";
import { brandSchema, type BrandInput } from "@/lib/validation/schemas/brand.schema";
import type { BrandDto } from "@server/catalog/brand.types";

interface BrandsManagerProps {
  orgId: string;
  brands: BrandDto[];
}

/**
 * The brands an org sells (org-profile spec R3, trd D8 step three). The list is server-rendered
 * by the page; this component opens the form and refreshes. Only a name is asked for — the rest
 * is filled when a channel needs it, never demanded here (R5).
 */
export function BrandsManager({ orgId, brands }: BrandsManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<BrandDto | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setIsOpen(true);
  };
  const openEdit = (brand: BrandDto) => {
    setEditing(brand);
    setIsOpen(true);
  };

  const { mutate: retireBrand } = useMutation(
    (brand: BrandDto) => orgBrandsApiClient.retire(orgId, brand.id).then(() => brand),
    {
      onSuccess: (brand) => {
        toast.success(brand.isDefault ? "Brand retired. You have no default brand now." : "Brand retired");
        router.refresh();
      },
    },
  );

  // Retirement, never deletion (ADR-0032): the brand stays readable for whatever names it.
  // Retiring the default is allowed — nothing here is compulsory (R5) — but never silently.
  const retire = (brand: BrandDto) => {
    const warning = brand.isDefault
      ? `"${brand.name}" is your default brand. After retiring it no brand is the default until you choose another. Retire it?`
      : `Retire "${brand.name}"? Products that use it keep their values.`;
    if (!confirm(warning)) return;
    // `useMutation` toasts the failure and rethrows; catching keeps it from going unhandled.
    void retireBrand(brand).catch(() => {});
  };
  const currentDefault = brands.find((brand) => brand.isDefault) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Your own brand, or the ones you carry. A brand remembers its maker and origin so you
          type them once, not per product.
        </p>
        <Button onClick={openAdd} size="sm">
          <Icon name="add" className="mr-1" /> Add brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon name="factory" size="xl" tone="muted" />
            <p className="text-sm text-muted-foreground">
              No brands yet. Add one with just its name; fill in the maker when you have the pack
              in front of you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{brand.name}</CardTitle>
                {brand.isDefault && <Badge>Default</Badge>}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1 text-muted-foreground">
                  <p>{brand.manufacturer ? `Made by ${brand.manufacturer}` : <em>Maker not given yet</em>}</p>
                  {brand.packerOrImporter && <p>Packed or imported by {brand.packerOrImporter}</p>}
                  <p>{brand.countryOfOrigin ? `From ${countryName(brand.countryOfOrigin)}` : <em>Origin not given yet</em>}</p>
                </div>
                <div className="flex justify-end gap-1 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(brand)}
                    aria-label={`Edit ${brand.name}`}
                  >
                    <Icon name="edit" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => retire(brand)}
                    aria-label={`Retire ${brand.name}`}
                  >
                    <Icon name="archive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit brand" : "Add brand"}</DialogTitle>
          </DialogHeader>
          <BrandForm
            key={editing?.id ?? "new"}
            orgId={orgId}
            brand={editing}
            currentDefault={currentDefault}
            onDone={() => {
              setIsOpen(false);
              router.refresh();
            }}
            onCancel={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrandForm({
  orgId,
  brand,
  currentDefault,
  onDone,
  onCancel,
}: {
  orgId: string;
  brand: BrandDto | null;
  /** Whichever brand is the default now, so a change of default is announced, not discovered. */
  currentDefault: BrandDto | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<BrandInput>({
    schema: brandSchema,
    submit: (data) => orgBrandsApiClient.save(orgId, brand?.id, data),
    successMessage: brand ? "Brand updated" : "Brand added",
    onSuccess: (result) => {
      const saved = result as BrandDto;
      const isDefault = getValues("isDefault");
      if (isDefault && currentDefault && currentDefault.id !== saved.id) {
        toast.info(`"${saved.name}" is now your default brand; "${currentDefault.name}" no longer is.`);
      } else if (isDefault && !currentDefault) {
        toast.info(`"${saved.name}" is now your default brand.`);
      } else if (!isDefault && brand?.isDefault) {
        toast.info(`"${saved.name}" is no longer your default brand. You have no default now.`);
      }
      onDone();
    },
    defaultValues: {
      name: brand?.name ?? "",
      manufacturer: brand?.manufacturer ?? "",
      packerOrImporter: brand?.packerOrImporter ?? "",
      countryOfOrigin: asCountryCode(brand?.countryOfOrigin),
      isDefault: brand?.isDefault ?? false,
    },
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-3">
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        Only the name is needed now. The rest is read off the pack when you have it.
      </p>
      <FormInput
        label="Brand name"
        placeholder="As printed on the pack"
        {...register("name")}
        error={errors.name?.message}
      />
      <FormInput
        label="Made by"
        placeholder="Manufacturer"
        {...register("manufacturer")}
        error={errors.manufacturer?.message}
        hint="The maker named on the label"
      />
      <FormInput
        label="Packed or imported by"
        {...register("packerOrImporter")}
        error={errors.packerOrImporter?.message}
        hint="When it differs from the maker"
      />
      <FormController
        name="countryOfOrigin"
        control={control}
        label="Country of origin"
        hint="Where this brand's products are made, unless a product says otherwise"
        error={errors.countryOfOrigin?.message}
        render={({ field }) => (
          <CountryPicker value={typeof field.value === "string" ? field.value : null} onChange={field.onChange} />
        )}
      />
      <Checkbox
        label="Default brand"
        description={
          currentDefault && currentDefault.id !== brand?.id
            ? `Used for products that do not name a brand of their own. "${currentDefault.name}" is the default now and would stop being it.`
            : "Used for products that do not name a brand of their own."
        }
        checked={watch("isDefault")}
        onChange={(event) => setValue("isDefault", event.target.checked)}
      />

      <div className="flex justify-end pt-2">
        <FormActions
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitLabel={brand ? "Save changes" : "Add brand"}
        />
      </div>
    </form>
  );
}
