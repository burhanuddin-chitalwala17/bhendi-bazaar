import { DataTable, Column } from "@/admin/data-table";
import { Edit, Trash2, CheckCircle, XCircle, MapPin, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OrgWithStats } from "@/domain/org";

interface OrgsTableProps {
  orgs: OrgWithStats[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onView: (org: OrgWithStats) => void;
  onEdit: (org: OrgWithStats) => void;
  onDelete: (id: string, name: string) => void;
}

export function OrgsTable({
  orgs,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  isLoading,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: OrgsTableProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-semibold">
            {org.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{org.name}</p>
            <p className="text-sm text-gray-500">{org.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "location",
      label: "Location",
      render: (org) => (
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              {org.defaultCity}, {org.defaultState}
            </p>
            <p className="text-gray-500">Pincode: {org.defaultPincode}</p>
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
            <p className="font-medium text-gray-900">{org.phone}</p>
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
            <p className="text-2xl font-bold text-gray-900">
              {org.productCount || 0}
            </p>
            <p className="text-xs text-gray-500">Products</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-2xl font-bold text-emerald-600">
              {org.totalStock || 0}
            </p>
            <p className="text-xs text-gray-500">Stock</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (org) => (
        <Badge
          variant={org.isActive ? "default" : "secondary"}
          className={org.isActive ? "bg-green-500" : ""}
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
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (org) => (
        <div className="flex items-center gap-2">
          {/* ⭐ NEW: View button */}
          <button
            onClick={() => onView(org)}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="View org details"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => onEdit(org)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit org"
          >
            <Edit className="w-4 h-4" />
          </button>

          {/* <div className="flex items-center gap-2">
            <Switch
              checked={org.isActive}
              onCheckedChange={() => onToggleStatus(org.id, org.isActive)}
              className="data-[state=checked]:bg-green-500"
            />
            <span
              className={`text-xs font-medium ${
                org.isActive ? "text-green-600" : "text-gray-400"
              }`}
            >
              {org.isActive ? "Active" : "Inactive"}
            </span>
          </div> */}

          <button
            onClick={() => onDelete(org.id, org.name)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete org"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Showing X-Y of Z results */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <p>
          Showing {startItem} to {endItem} of {totalItems} orgs
        </p>
      </div>
      <div className="overflow-x-auto">
        <DataTable
          data={orgs}
          columns={columns}
          totalPages={totalPages}
          currentPage={currentPage}
          totalItems={totalItems}
          onPageChange={onPageChange}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
