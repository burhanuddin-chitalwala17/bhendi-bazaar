import Link from "next/link";
import { DataTable, Column } from "@/components/shared/data-table";
import { Edit, Ban, CheckCircle, XCircle, MapPin, Eye, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const columns: Column<OrgWithStats>[] = [
    {
      key: "code",
      label: "Code",
      render: (org) => (
        <span className="font-mono text-sm font-medium">{org.code}</span>
      ),
    },
    {
      key: "name",
      label: "Organisation",
      render: (org) => (
        <Link href={`/admin/orgs/${org.id}`} className="flex items-center gap-3 hover:underline">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-semibold">
            {org.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{org.name}</p>
            <p className="text-sm text-muted-foreground">{org.email}</p>
          </div>
        </Link>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (org) => (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground/70 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {org.contactPerson || "—"}
            </p>
            <p className="text-muted-foreground">{org.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (org) => (
        <div className="text-sm space-y-1">
          {org.phone && (
            <p className="font-medium text-foreground">
              {formatPhone(org.phone)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "stats",
      label: "Products",
      render: (org) => (
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold text-foreground">
              {org.productCount || 0}
            </p>
            <p className="text-xs text-muted-foreground">Products</p>
          </div>
          <div className="h-8 w-px bg-muted" />
          <div>
            <p className="text-2xl font-bold text-primary">
              {org.totalStock || 0}
            </p>
            <p className="text-xs text-muted-foreground">Stock</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (org) => (
        <div className="flex flex-col gap-1">
          <Badge
            variant={org.isActive ? "default" : "secondary"}
            className={org.isActive ? "bg-success" : ""}
          >
            {org.isActive ? (
              <>
                <CheckCircle className="mr-1 h-3 w-3" />
                Active
              </>
            ) : (
              <>
                <XCircle className="mr-1 h-3 w-3" />
                Inactive
              </>
            )}
          </Badge>
          {org.isBlocked && (
            <Badge variant="destructive">
              <Ban className="mr-1 h-3 w-3" />
              Blocked
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (org) => (
        <div className="flex items-center gap-2">
          {/* ⭐ NEW: View button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onView(org)}
            className="text-muted-foreground hover:bg-muted/60"
            title="View org details"
          >
            <Eye className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(org)}
            className="text-info hover:bg-info/10"
            title="Edit org"
          >
            <Edit className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleBlock(org)}
            className={org.isBlocked ? "text-success hover:bg-success/10" : "text-destructive hover:bg-destructive/10"}
          >
            {org.isBlocked ? <ShieldOff className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Showing X-Y of Z results */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <p>
          Showing {startItem} to {endItem} of {total} orgs
        </p>
      </div>
      <div className="overflow-x-auto">
        <DataTable
          data={orgs}
          columns={columns}
          totalPages={totalPages}
          currentPage={page}
          totalItems={total}
          pageSize={limit}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
