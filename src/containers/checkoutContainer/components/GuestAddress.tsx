"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AddressFields } from "@/components/shared/forms/AddressFields";
import { DeliveryAddress } from "@/domain/profile";
import { postalCodeSchema } from "@/lib/validation/schemas/common.schemas";

export const guestAddressSchema = z.object({
  id: z.string(),
  fullName: z.string().min(2, "Name required"),
  mobile: z.string().regex(/^\d{10}$/, "10 digits required"),
  // Optional (the UI says so), but validated when present; "" is "left blank".
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  addressLine1: z.string().min(5, "Address required"),
  addressLine2: z.string().optional(),
  landmark: z.string().optional(),
  city: z.string().min(2, "City required"),
  state: z.string().min(2, "State required"),
  pincode: postalCodeSchema,
  country: z.string().min(2, "Country required"),
  metadata: z.record(z.string(), z.any()).optional(),
});

export function GuestAddress({ onAddressChange }: { onAddressChange: (address: DeliveryAddress) => void }) {

  const {
    register,
    watch,
    formState: { errors, isValid },
  } = useForm<DeliveryAddress>({
    resolver: zodResolver(guestAddressSchema),
    mode: "onChange",
    defaultValues: {
      // A guest address has no id; without this default the required `id`
      // keeps the form invalid forever and shipping rates never load.
      id: "",
      country: "India",
    },
  });
  // Watch individual fields
  const fullName = watch("fullName");
  const mobile = watch("mobile");
  const email = watch("email");
  const addressLine1 = watch("addressLine1");
  const addressLine2 = watch("addressLine2");
  const city = watch("city");
  const state = watch("state");
  const pincode = watch("pincode");
  const country = watch("country");
  const landmark = watch("landmark");
  // useMemo with ACTUAL dependencies
  const formValues: Omit<DeliveryAddress, "id"> = useMemo(() => ({
    fullName: fullName || "",
    mobile: mobile || "",
    email: email || "",
    addressLine1: addressLine1 || "",
    addressLine2: addressLine2 || "",
    landmark: landmark || "",
    city: city || "",
    state: state || "",
    pincode: pincode || "",
    country: country || "India",
  }), [fullName, mobile, email, addressLine1, addressLine2, landmark, city, state, pincode, country]);

  useEffect(() => {
    if (isValid) {
      onAddressChange({ ...formValues, id: "" });
    }
  }, [formValues, isValid, onAddressChange]);

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium uppercase tracking-eyebrow text-muted-foreground/80">
        Delivery Address
      </label>

      <div className="rounded-xl border border-border/70 bg-card/80 p-4">
        <AddressFields
          register={register}
          errors={errors}
        />
      </div>
    </div>
  );
}