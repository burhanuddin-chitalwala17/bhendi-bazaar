/**
 * Every org-portal page — including /org and /org/new, which sit outside the
 * [orgId] membership layout — shares the portal surface: neutral grounds scoped by
 * the `.portal` token override in globals.css.
 */
export default function OrgGroupLayout({ children }: { children: React.ReactNode }) {
  return <div className="portal min-h-screen bg-background">{children}</div>;
}
