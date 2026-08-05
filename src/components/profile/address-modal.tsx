"use client";

import type { DeliveryAddress } from "@/domain/profile";
import { X, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormActions } from "../shared/button-groups/FormActions";
import { DefaultBadge } from "../shared/badges/StatusBadge";
import { AddressFields } from "../shared/forms/AddressFields";
import { useServerForm } from "@/hooks/core/useServerForm";
import { addAddressSchema } from "@/lib/validation/schemas/address.schema";

interface AddressModalProps {
  mode: "view" | "edit" | "add";
  address: DeliveryAddress;
  saving: boolean;
  onClose: () => void;
  onSave: (address: DeliveryAddress) => void | Promise<void>;
  onStartEdit: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
}

export function AddressModal({
  mode,
  address,
  saving,
  onClose,
  onSave,
  onStartEdit,
  onSetDefault,
  onDelete,
}: AddressModalProps) {
  const isEditing = mode === "edit" || mode === "add";

  function handleSave(data: DeliveryAddress) {
    void onSave({ ...address, ...data });
  }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
              {mode === "add"
                ? "Add address"
                : mode === "edit"
                ? "Edit address"
                : "Address details"}
            </p>
            <p className="text-[0.7rem] text-muted-foreground">
              {mode === "view"
                ? "Full address and contact details."
                : "These details will be used for delivery and updates."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-xs hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {mode === "view" && (
          <AddressViewMode
            address={address}
            saving={saving}
            onStartEdit={onStartEdit}
            onSetDefault={onSetDefault}
            onDelete={onDelete}
          />
        )}

        {isEditing && (
          <AddressForm
            address={address}
            saving={saving}
            onSubmit={handleSave}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}

interface AddressViewModeProps {
  address: DeliveryAddress;
  saving: boolean;
  onStartEdit: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
}

function AddressViewMode({
  address,
  saving,
  onStartEdit,
  onSetDefault,
  onDelete,
}: AddressViewModeProps) {
  return (
    <div className="space-y-4 px-4 py-4 text-sm">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold">{address.metadata?.label}</p>
          {address.metadata?.isDefault && <DefaultBadge />}
        </div>
      </div>
      <p className="font-semibold">{address.fullName}</p>
      <p className="text-xs text-muted-foreground">{address.mobile}</p>
      <p className="text-xs text-muted-foreground">{address.email}</p>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p>{address.addressLine1}</p>
        {address.addressLine2 && <p>{address.addressLine2}</p>}
        <p>
          {[address.city, address.state, address.pincode]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p>{address.country}</p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-2">
          {onSetDefault && !address.metadata?.isDefault && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={onSetDefault}
              className="rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
            >
              Make default
            </Button>
          )}
          {/* ✅ Add delete button */}
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={saving}
              onClick={onDelete}
              className="rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
            >
              Delete
            </Button>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onStartEdit}
          className="rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
        >
          <Edit3 className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </div>
    </div>
  );
}

interface AddressFormProps {
  address: DeliveryAddress;
  saving: boolean;
  onSubmit: (address: DeliveryAddress) => void;
  onCancel: () => void;
}

function AddressForm({
  address,
  saving,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors },
  } = useServerForm<DeliveryAddress>({
    schema: addAddressSchema as never,
    submit: async (data) => onSubmit(data),
    defaultValues: address,
  });

  return (
    <form
      onSubmit={handleFormSubmit}
      className="space-y-3 px-4 py-4 text-xs"
    >
      {formError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {formError}
        </div>
      )}
      <AddressFields
        register={register}
        errors={errors}
        includeEmail={true}
        includeNotes={false}
        includeLabel={true}
      />

      <div className="flex items-center justify-between gap-2 pt-2">
        <label className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
          <input
            type="checkbox"
            {...register("metadata.isDefault")}
            className="h-3.5 w-3.5 rounded border border-border bg-background"
          />
          Set as default address
        </label>
        <FormActions
          onCancel={onCancel}
          isSubmitting={saving}
          submitLabel="Save"
          cancelLabel="Cancel"
        />
      </div>
    </form>
  );
}

