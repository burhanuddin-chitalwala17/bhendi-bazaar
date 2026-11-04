/** The admin's shop pages (ADR-0067). */
export const ADMIN_ORGS_COPY = {
  back: "Shops",
  description: (code: string, email: string) => `${code} · ${email}`,
  blocked: "Blocked",
  addProduct: "Add product for this shop",
  addMany: "Add many for this shop",
  backTo: (name: string) => `Back to ${name}`,
  noAddress: (name: string) => `${name} has no pickup address yet. Add one for them first.`,
} as const;
