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
import { BRANDS_COPY } from "./brands-copy";

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
        toast.success(brand.isDefault ? BRANDS_COPY.retiredDefault : BRANDS_COPY.retired);
        router.refresh();
      },
    },
  );

  const currentDefault = brands.find((brand) => brand.isDefault) ?? null;

  // Retirement, never deletion (ADR-0032): the brand stays readable for whatever names it.
  // Retiring the default is allowed — nothing here is compulsory (R5) — but never silently.
  const retire = (brand: BrandDto) => {
    const warning = brand.isDefault
      ? BRANDS_COPY.confirmRetireDefault(brand.name)
      : BRANDS_COPY.confirmRetire(brand.name);
    if (!confirm(warning)) return;
    // `useMutation` toasts the failure and rethrows; catching keeps it from going unhandled.
    void retireBrand(brand).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{BRANDS_COPY.intro}</p>
        <Button onClick={openAdd} size="sm">
          <Icon name="add" className="mr-1" /> {BRANDS_COPY.add}
        </Button>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon name="factory" size="xl" tone="muted" />
            <p className="text-sm text-muted-foreground">{BRANDS_COPY.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {brands.map((brand) => (
            <Card key={brand.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{brand.name}</CardTitle>
                {brand.isDefault && <Badge>{BRANDS_COPY.isDefault}</Badge>}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1 text-muted-foreground">
                  <p>{brand.manufacturer ? BRANDS_COPY.madeBy(brand.manufacturer) : <em>{BRANDS_COPY.makerMissing}</em>}</p>
                  {brand.packerOrImporter && <p>{BRANDS_COPY.packedBy(brand.packerOrImporter)}</p>}
                  <p>{brand.countryOfOrigin ? BRANDS_COPY.from(countryName(brand.countryOfOrigin)) : <em>{BRANDS_COPY.originMissing}</em>}</p>
                </div>
                <div className="flex justify-end gap-1 border-t pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(brand)}
                    aria-label={BRANDS_COPY.editLabel(brand.name)}
                  >
                    <Icon name="edit" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => retire(brand)}
                    aria-label={BRANDS_COPY.retireLabel(brand.name)}
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
            <DialogTitle>{editing ? BRANDS_COPY.edit : BRANDS_COPY.add}</DialogTitle>
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
    successMessage: brand ? BRANDS_COPY.updated : BRANDS_COPY.added,
    onSuccess: (result) => {
      const saved = result as BrandDto;
      const isDefault = getValues("isDefault");
      if (isDefault && currentDefault && currentDefault.id !== saved.id) {
        toast.info(BRANDS_COPY.defaultMoved(saved.name, currentDefault.name));
      } else if (isDefault && !currentDefault) {
        toast.info(BRANDS_COPY.defaultSet(saved.name));
      } else if (!isDefault && brand?.isDefault) {
        toast.info(BRANDS_COPY.defaultCleared(saved.name));
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

      <p className="text-xs text-muted-foreground">{BRANDS_COPY.formIntro}</p>
      <FormInput
        label={BRANDS_COPY.name}
        placeholder={BRANDS_COPY.namePlaceholder}
        {...register("name")}
        error={errors.name?.message}
      />
      <FormInput
        label={BRANDS_COPY.maker}
        placeholder={BRANDS_COPY.makerPlaceholder}
        {...register("manufacturer")}
        error={errors.manufacturer?.message}
        hint={BRANDS_COPY.makerHint}
      />
      <FormInput
        label={BRANDS_COPY.packer}
        {...register("packerOrImporter")}
        error={errors.packerOrImporter?.message}
        hint={BRANDS_COPY.packerHint}
      />
      <FormController
        name="countryOfOrigin"
        control={control}
        label={BRANDS_COPY.country}
        hint={BRANDS_COPY.countryHint}
        error={errors.countryOfOrigin?.message}
        render={({ field }) => (
          <CountryPicker value={typeof field.value === "string" ? field.value : null} onChange={field.onChange} />
        )}
      />
      <Checkbox
        label={BRANDS_COPY.defaultBrand}
        description={
          currentDefault && currentDefault.id !== brand?.id
            ? BRANDS_COPY.defaultHintReplacing(currentDefault.name)
            : BRANDS_COPY.defaultHint
        }
        checked={watch("isDefault")}
        onChange={(event) => setValue("isDefault", event.target.checked)}
      />

      <div className="flex justify-end pt-2">
        <FormActions
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          submitLabel={brand ? BRANDS_COPY.save : BRANDS_COPY.add}
        />
      </div>
    </form>
  );
}
