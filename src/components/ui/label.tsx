/**
 * Label Component
 * Reusable label for form fields
 */

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className = "", ...props }: LabelProps) {
  return (
    <label
      className={`block text-sm font-medium text-foreground/80 mb-1 ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

