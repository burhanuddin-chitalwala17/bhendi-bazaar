import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrgForm } from "@/components/shared/forms/orgs";
import type { Org } from "@/domain/org";
import type { OrgFormInput } from "@/lib/validation/schemas/org.schema";
import { ADD_ORG_TITLE_COPY } from "@/components/org/console/org-console-copy";

interface AddOrgModalProps {
  open: boolean;
  onClose(): void;
  onSubmit(data: OrgFormInput): Promise<void>;
  org?: Org; // For edit mode
  isSubmitting?: boolean;
  mode?: "create" | "edit" | "view";
}

export function AddOrgModal({
  open,
  onClose,
  onSubmit,
  org,
  isSubmitting = false,
  mode = "create",
}: AddOrgModalProps) {
  const isEdit = mode === "edit";
  const isView = mode === "view";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? ADD_ORG_TITLE_COPY.edit(org?.name || "")
              : isView
                ? ADD_ORG_TITLE_COPY.view(org?.name || "")
                : ADD_ORG_TITLE_COPY.add}
          </DialogTitle>
        </DialogHeader>

        <OrgForm
          org={org}
          onSubmit={onSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
          readOnly={isView}
        />
      </DialogContent>
    </Dialog>
  );
}
