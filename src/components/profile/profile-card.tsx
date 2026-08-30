"use client";

import { useState } from "react";
import { Camera, Edit3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User } from "@/domain/profile";
import { ProfilePicUpload } from "./profile-pic-upload";
import { LoadingSpinner } from "../shared/states/LoadingSpinner";
import { SectionHeader } from "../shared/SectionHeader";
import { FormActions } from "../shared/button-groups/FormActions";
import { ChangePasswordModal } from "./change-password-modal";

interface ProfileCardProps {
  user: User | null;
  profilePic?: string | null;
  loading?: boolean;
  saving?: boolean;
  fallbackName?: string;
  onUpdate: (data: {
    name?: string;
    email?: string;
    mobile?: string;
  }) => Promise<void>;
  onUpdateProfilePic: (profilePic: string) => Promise<void>;
}

export function ProfileCard({
  user,
  profilePic,
  loading,
  saving,
  fallbackName = "",
  onUpdate,
  onUpdateProfilePic,
}: ProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPic, setIsEditingPic] = useState(false);
  const [picUrl, setPicUrl] = useState(profilePic ?? "");
  const [formData, setFormData] = useState({
    name: user?.name ?? fallbackName,
    email: user?.email ?? "",
    mobile: user?.mobile ?? "",
  });

  const name = user?.name ?? fallbackName;
  const email = user?.email ?? null;
  const mobile = user?.mobile ?? null;
  const initial = name?.charAt(0)?.toUpperCase() ?? "B";

  function handleEdit() {
    setFormData({
      name: user?.name ?? fallbackName,
      email: user?.email ?? "",
      mobile: user?.mobile ?? "",
    });
    setIsEditing(true);
  }

  async function handleSave() {
    await onUpdate({
      name: formData.name || undefined,
      email: formData.email || undefined,
      mobile: formData.mobile || undefined,
    });
    setIsEditing(false);
  }

  function handleCancel() {
    setIsEditing(false);
  }

  function handleEditPic() {
    setPicUrl(profilePic ?? "");
    setIsEditingPic(true);
  }

  async function handleSavePic() {
    if (picUrl.trim()) {
      await onUpdateProfilePic(picUrl.trim());
    }
    setIsEditingPic(false);
  }

  function handleCancelPic() {
    setIsEditingPic(false);
    setPicUrl("");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeader overline="Account" title="Your account information" />
          {!isEditing && !isEditingPic && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEdit}
              disabled={loading}
              className="rounded-full text-2xs font-semibold uppercase tracking-eyebrow"
            >
              <Edit3 className="mr-1 h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!isEditing && !isEditingPic ? (
          <div className="flex items-center gap-4">
            {/* Profile Picture with Edit Button */}
            <div className="relative">
              {profilePic ? (
                <img
                  src={profilePic}
                  alt={name || "Profile"}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                  {initial}
                </div>
              )}
              {!isEditingPic && (
                <button
                  type="button"
                  onClick={handleEditPic}
                  className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-raised hover:bg-primary/90"
                  title="Change profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {loading && !name ? "Loading…" : name || "Your name"}
              </p>
              {email && (
                <p className="text-xs text-muted-foreground">{email}</p>
              )}
              {mobile && (
                <p className="text-xs text-muted-foreground">+91 {mobile}</p>
              )}
            </div>
          </div>
        ) : isEditingPic ? (
          <ProfilePicUpload
            currentPic={profilePic ?? ""}
            userName={name}
            onUploadComplete={async (url) => {
              await onUpdateProfilePic(url);
              setIsEditingPic(false);
            }}
            onCancel={handleCancelPic}
            onRemove={async () => {
              await onUpdateProfilePic("");
              setIsEditingPic(false);
            }}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-3 text-xs"
          >
            <div className="space-y-1">
              <label className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">
                Name
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">
                Mobile Number
              </label>
              <Input
                type="tel"
                value={formData.mobile}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, mobile: e.target.value }))
                }
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="flex gap-2">
              <ChangePasswordModal />
            </div>
            <FormActions
              onCancel={handleCancel}
              isSubmitting={saving}
              submitLabel="Save"
              cancelLabel="Cancel"
            />
          </form>
        )}
      </CardContent>
    </Card>
  );
}
