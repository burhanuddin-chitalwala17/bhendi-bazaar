import Link from "next/link";
import { DataTable, Column } from "@/components/shared/data-table";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import type { OrgWithStats } from "@/domain/org";
import type { Pagination } from "@/types/shared";
import { formatPhone } from "@server/shared/phone";
import { Button } from "@/components/ui/button";
import { ORG_CONSOLE_COPY, ORGS_TABLE_COPY } from "../org-console-copy";
import { ROUTES } from "@server/shared/routes";

interface OrgsTableProps {
  orgs: OrgWithStats[];
  pagination: Pagination;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (org: OrgWithStats) => void;
  onEdit: (org: OrgWithStats) => void;
  onToggleBlock: (org: OrgWithStats) => void;
}

export function OrgsTable({
  orgs,
  pagination,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onToggleBlock,
}: OrgsTableProps) {
  const { page, limit, total, totalPages } = pagination;

  const columns: Column<OrgWithStats>[] = [
    {
      key: "name",
      label: ORGS_TABLE_COPY.shop,
      phone: "title",
      render: (org) => (
        <Link href={ROUTES.admin.org(org.id)} prefetch={false} className="flex items-center gap-3 hover:underline">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-small font-semibold text-muted-foreground"
          >
            {org.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{org.name}</span>
            <span className="block font-mono text-caption font-normal text-muted-foreground">{org.code}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "contact",
      label: ORGS_TABLE_COPY.contact,
      phone: "hidden",
      render: (org) => (
        <div className="text-small">
          <p className="text-foreground">{org.contactPerson || "—"}</p>
          <p className="text-muted-foreground">{org.email}</p>
        </div>
      ),
    },
    {
      key: "phone",
      label: ORGS_TABLE_COPY.phone,
      phone: "hidden",
      render: (org) => (org.phone ? formatPhone(org.phone) : "—"),
    },
    {
      key: "products",
      label: ORGS_TABLE_COPY.products,
      phone: "meta",
      render: (org) => ORGS_TABLE_COPY.productCount(org.productCount || 0),
    },
    {
      key: "stock",
      label: ORGS_TABLE_COPY.stock,
      phone: "meta",
      render: (org) => ORGS_TABLE_COPY.inStock(org.totalStock || 0),
    },
    {
      key: "status",
      label: ORGS_TABLE_COPY.status,
      phone: "status",
      render: (org) => (
        org.isBlocked ? (
          <StatusBadge tone="destructive" dot>{ORGS_TABLE_COPY.blocked}</StatusBadge>
        ) : (
          <StatusBadge tone={org.isActive ? "success" : "neutral"} dot>
            {org.isActive ? ORG_CONSOLE_COPY.active : ORG_CONSOLE_COPY.inactive}
          </StatusBadge>
        )
      ),
    },
    {
      key: "actions",
      label: ORGS_TABLE_COPY.actions,
      phone: "trailing",
      render: (org) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onView(org)} aria-label={ORGS_TABLE_COPY.viewLabel(org.name)} className="hidden md:inline-flex">
            <Icon name="show" />
            {ORGS_TABLE_COPY.view}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(org)} aria-label={ORGS_TABLE_COPY.editLabel(org.name)}>
            <Icon name="edit" />
            {ORGS_TABLE_COPY.edit}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleBlock(org)}
            aria-label={ORGS_TABLE_COPY.toggleLabel(org.isBlocked, org.name)}
          >
            <Icon name={org.isBlocked ? "secure" : "block"} />
            {org.isBlocked ? ORG_CONSOLE_COPY.unblock : ORG_CONSOLE_COPY.block}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={orgs}
      columns={columns}
      label={ORGS_TABLE_COPY.label}
      totalPages={totalPages}
      currentPage={page}
      totalItems={total}
      pageSize={limit}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      isLoading={isLoading}
    />
  );
}
