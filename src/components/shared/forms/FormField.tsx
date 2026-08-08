// components/shared/forms/FormField.tsx

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
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
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  children,
  className,
  disabled = false,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className={cn("text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground", disabled && "text-muted-foreground")}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
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
}: Omit<FormFieldProps, "children"> & React.ComponentProps<typeof Input>) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <Input {...inputProps} aria-invalid={!!error} />
    </FormField>
  );
}

export function FormTextarea({
  label,
  required,
  error,
  hint,
  ...textareaProps
}: Omit<FormFieldProps, "children"> & React.ComponentProps<typeof Textarea>) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <Textarea {...textareaProps} aria-invalid={!!error} />
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
}: Omit<FormFieldProps, "children"> &
  React.ComponentProps<typeof Select> & { children: React.ReactNode }) {
  return (
    <FormField
      label={label}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <Select {...selectProps} aria-invalid={!!error}>
        {children}
      </Select>
    </FormField>
  );
}
// In FormField.tsx, update the FormController:

interface FormControllerProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  rules?: RegisterOptions<T>;
  render: (props: {
    field: ControllerRenderProps<T, Path<T>>;
    fieldState: ControllerFieldState;
    formState: UseFormStateReturn<T>;
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
  return (
    <FormField
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
        render={(props) => render(props)} // Pass the entire props object
      />
    </FormField>
  );
}