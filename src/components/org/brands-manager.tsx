"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Factory, Pencil, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormInput } from "@/components/shared/forms/FormField";
import { CountrySelect } from "@/components/shared/forms/CountrySelect";
import { asCountryCode, countryName } from "@server/shared/countries";
import { FormActions } from "@/components/shared/button-groups/FormActions";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
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

  // Retirement, never deletion (ADR-0032): the brand stays readable for whatever names it.
  // Retiring the default is allowed — nothing here is compulsory (R5) — but never silently.
  const retire = async (brand: BrandDto) => {
    const warning = brand.isDefault
      ? `"${brand.name}" is your default brand. After retiring it no brand is the default until you choose another. Retire it?`
      : `Retire "${brand.name}"? Products that use it keep their values.`;
    if (!confirm(warning)) return;
    const response = await fetch(`/api/org/${orgId}/brands/${brand.id}/retire`, { method: "POST" });
    if (!response.ok) {
      const error = await readApiError(response);
      toast.error(error.message);
      return;
    }
    toast.success(brand.isDefault ? "Brand retired. You have no default brand now." : "Brand retired");
    router.refresh();
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
          <Plus className="mr-1 size-4" /> Add brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Factory className="size-8 text-muted-foreground" />
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
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => retire(brand)}
                    aria-label={`Retire ${brand.name}`}
                  >
                    <Archive className="size-4" />
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
    watch,
    setValue,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<BrandInput>({
    schema: brandSchema,
    submit: async (data) => {
      const response = await fetch(
        brand ? `/api/org/${orgId}/brands/${brand.id}` : `/api/org/${orgId}/brands`,
        {
          method: brand ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) throw await readApiError(response);
      const saved = (await response.json()) as BrandDto;
      toast.success(brand ? "Brand updated" : "Brand added");
      if (data.isDefault && currentDefault && currentDefault.id !== saved.id) {
        toast.info(`"${saved.name}" is now your default brand; "${currentDefault.name}" no longer is.`);
      } else if (data.isDefault && !currentDefault) {
        toast.info(`"${saved.name}" is now your default brand.`);
      } else if (!data.isDefault && brand?.isDefault) {
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
      <CountrySelect
        label="Country of origin"
        {...register("countryOfOrigin")}
        error={errors.countryOfOrigin?.message}
        hint="Where this brand's products are made, unless a product says otherwise"
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
