import { forwardRef } from "react";
import { FormSelect } from "@/components/shared/forms/FormField";
import { countryOptions } from "@server/shared/countries";

const OPTIONS = countryOptions();

type Props = Omit<React.ComponentProps<typeof FormSelect>, "children"> & {
  /** The blank option's wording — what "no country" means on this form. */
  blankLabel?: string;
};

/** One country list for every form that asks for one: ISO codes stored, names shown. */
export const CountrySelect = forwardRef<HTMLSelectElement, Props>(function CountrySelect(
  { blankLabel = "Not set", ...props },
  ref,
) {
  return (
    <FormSelect ref={ref} {...props}>
      <option value="">{blankLabel}</option>
      {OPTIONS.map((option) => (
        <option key={option.code} value={option.code}>
          {option.name}
        </option>
      ))}
    </FormSelect>
  );
});
