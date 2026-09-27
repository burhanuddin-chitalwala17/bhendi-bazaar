"use client";

/**
 * A GET form that submits itself when any field changes, so a filter applies as it is picked.
 * The submit button inside stays as the control that works without script, and for a date
 * being typed, whose change fires once it is complete.
 */
export function AutoSubmitForm({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form method="get" className={className} onChange={(event) => event.currentTarget.requestSubmit()}>
      {children}
    </form>
  );
}
