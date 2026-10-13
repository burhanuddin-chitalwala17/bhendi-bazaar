// components/shared/forms/FormField.tsx

import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  FieldValues,
  Path,
  Control,
  Controller,
  RegisterOptions,
  ControllerRenderProps,
  ControllerFieldState,
  UseFormStateReturn,
} from "react-hook-form";

interface FormFieldProps {
  /** The control's id; the label points at it and the messages are named from it. */
  id?: string;
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

/** The ids of the hint and error `FormField` renders for a control, for `aria-describedby`. */
export function fieldMessageIds(id: string) {
  return { hint: `${id}-hint`, error: `${id}-error` };
}

/** Only the message actually rendered is referenced: the hint hides while an error shows. */
function describedBy(
  id: string,
  { hint, error }: { hint?: string; error?: string },
  existing?: string,
): string | undefined {
  const ids = fieldMessageIds(id);
  const own = error ? ids.error : hint ? ids.hint : undefined;
  return [existing, own].filter(Boolean).join(" ") || undefined;
}

export function FormField({
  id,
  label,
  required = false,
  error,
  hint,
  children,
  className,
  disabled = false,
}: FormFieldProps) {
  const ids = id ? fieldMessageIds(id) : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <Label
        variant="eyebrow"
        htmlFor={id}
        required={required}
        // `disabled` used to add the same colour the label already has; kept as a prop, no-op.
        className="text-muted-foreground"
        data-disabled={disabled || undefined}
      >
        {label}
      </Label>
      {children}
      {hint && !error && (
        <p id={ids?.hint} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={ids?.error} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Quick use variants
export function FormInput({
  label,
  required,
  error,
  hint,
  ...inputProps
}: Omit<FormFieldProps, "children" | "id"> & React.ComponentProps<typeof Input>) {
  const generated = useId();
  const id = inputProps.id ?? generated;
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      <Input
        {...inputProps}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { hint, error }, inputProps["aria-describedby"])}
      />
    </FormField>
  );
}

export function FormTextarea({
  label,
  required,
  error,
  hint,
  ...textareaProps
}: Omit<FormFieldProps, "children" | "id"> & React.ComponentProps<typeof Textarea>) {
  const generated = useId();
  const id = textareaProps.id ?? generated;
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      <Textarea
        {...textareaProps}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { hint, error }, textareaProps["aria-describedby"])}
      />
    </FormField>
  );
}

export function FormSelect({
  label,
  required,
  error,
  hint,
  className,
  children,
  ...selectProps
}: Omit<FormFieldProps, "children" | "id"> &
  React.ComponentProps<typeof Select> & { children: React.ReactNode }) {
  const generated = useId();
  const id = selectProps.id ?? generated;
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <Select
        {...selectProps}
        id={id}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, { hint, error }, selectProps["aria-describedby"])}
      >
        {children}
      </Select>
    </FormField>
  );
}

interface FormControllerProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  rules?: RegisterOptions<T>;
  /** `id` is what the label points at; the rendered control should carry it. */
  render: (props: {
    field: ControllerRenderProps<T, Path<T>>;
    fieldState: ControllerFieldState;
    formState: UseFormStateReturn<T>;
    id: string;
  }) => React.ReactElement;
  disabled?: boolean;
}

export function FormController<T extends FieldValues>({
  name,
  control,
  label,
  required,
  error,
  hint,
  className,
  rules,
  render,
  disabled = false,
}: FormControllerProps<T>) {
  const id = useId();
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
      disabled={disabled}
    >
      <Controller
        name={name}
        control={control}
        rules={rules}
        render={(props) => render({ ...props, id })}
      />
    </FormField>
  );
}

interface FormPhoneInputProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Reads its error from field state rather than a prop, so it cannot render without it. */
export function FormPhoneInput<T extends FieldValues>({
  name,
  control,
  label,
  required,
  hint,
  placeholder,
  disabled,
  className,
}: FormPhoneInputProps<T>) {
  const id = useId();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormField
          id={id}
          label={label}
          required={required}
          hint={hint}
          error={fieldState.error?.message}
          className={className}
          disabled={disabled}
        >
          <PhoneInput
            id={id}
            value={typeof field.value === "string" ? field.value : ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={!!fieldState.error}
            aria-describedby={describedBy(id, { hint, error: fieldState.error?.message })}
          />
        </FormField>
      )}
    />
  );
}
