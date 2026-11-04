import Link from "next/link";
import { DataTable, Column } from "@/components/shared/data-table";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import type { OrgWithStats } from "@/domain/org";
import type { Pagination } from "@/types/shared";
import { formatPhone } from "@server/shared/phone";
import { Button } from "@/components/ui/button";

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
      label: "Shop",
      phone: "title",
      render: (org) => (
        <Link href={`/admin/orgs/${org.id}`} prefetch={false} className="flex items-center gap-3 hover:underline">
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
      label: "Contact",
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
      label: "Phone",
      phone: "hidden",
      render: (org) => (org.phone ? formatPhone(org.phone) : "—"),
    },
    {
      key: "products",
      label: "Products",
      phone: "meta",
      render: (org) => `${org.productCount || 0} products`,
    },
    {
      key: "stock",
      label: "Stock",
      phone: "meta",
      render: (org) => `${org.totalStock || 0} in stock`,
    },
    {
      key: "status",
      label: "Status",
      phone: "status",
      render: (org) =>
        org.isBlocked ? (
          <StatusBadge tone="destructive" dot>Blocked</StatusBadge>
        ) : (
          <StatusBadge tone={org.isActive ? "success" : "neutral"} dot>
            {org.isActive ? "Active" : "Inactive"}
          </StatusBadge>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      phone: "trailing",
      render: (org) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onView(org)} aria-label={`View ${org.name}`} className="hidden md:inline-flex">
            <Icon name="show" />
            View
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(org)} aria-label={`Edit ${org.name}`}>
            <Icon name="edit" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleBlock(org)}
            aria-label={`${org.isBlocked ? "Unblock" : "Block"} ${org.name}`}
          >
            <Icon name={org.isBlocked ? "secure" : "block"} />
            {org.isBlocked ? "Unblock" : "Block"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={orgs}
      columns={columns}
      label="Shops"
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
