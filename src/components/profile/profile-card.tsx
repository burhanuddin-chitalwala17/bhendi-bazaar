"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { User } from "@/domain/profile";
import { ProfilePicUpload } from "./profile-pic-upload";
import { SkeletonRows } from "../shared/states/skeletons";
import { SectionHeader } from "../shared/SectionHeader";
import { FormActions } from "../shared/button-groups/FormActions";
import { FormInput, FormPhoneInput } from "../shared/forms/FormField";
import { ChangePasswordModal } from "./change-password-modal";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  profileInfoFormSchema,
  type ProfileInfoFormInput,
} from "@/lib/validation/schemas/profile.schemas";
import { formatPhone } from "@server/shared/phone";
import { Icon } from "@/components/ui/icon";
import { PROFILE_CARD_COPY } from "./profile-copy";

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

  const name = user?.name ?? fallbackName;
  const email = user?.email ?? null;
  const mobile = user?.mobile ?? null;
  const initial = name?.charAt(0)?.toUpperCase() ?? "B";

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
      <div role="status" aria-label={PROFILE_CARD_COPY.loadingProfile}>
        <SkeletonRows count={1} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeader overline={PROFILE_CARD_COPY.account} title={PROFILE_CARD_COPY.accountInformation} />
          {!isEditing && !isEditingPic && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={loading}
              className="rounded-full text-2xs font-semibold uppercase tracking-eyebrow"
            >
              <Icon name="edit" size="xs" className="mr-1" />{PROFILE_CARD_COPY.edit}</Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!isEditing && !isEditingPic ? (
          <div className="flex items-center gap-4">
            {/* Profile Picture with Edit Button */}
            <div className="relative">
              {profilePic ? (
                <Image
                  src={profilePic}
                  alt={name || PROFILE_CARD_COPY.profile}
                  width={56}
                  height={56}
                  sizes="56px"
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                  {initial}
                </div>
              )}
              {!isEditingPic && (
                <Button
                  variant="default"
                  type="button"
                  onClick={handleEditPic}
                  className="absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow-raised"
                  title={PROFILE_CARD_COPY.changeProfilePicture}
                >
                  <Icon name="camera" size="sm" />
                </Button>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {loading && !name ? PROFILE_CARD_COPY.loading : name || PROFILE_CARD_COPY.yourName}
              </p>
              {email && (
                <p className="text-xs text-muted-foreground">{email}</p>
              )}
              {mobile && (
                <p className="text-xs text-muted-foreground">
                  {formatPhone(mobile)}
                </p>
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
          <ProfileInfoForm
            user={user}
            fallbackName={fallbackName}
            saving={saving}
            onUpdate={onUpdate}
            onDone={() => setIsEditing(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ProfileInfoForm({
  user,
  fallbackName,
  saving,
  onUpdate,
  onDone,
}: {
  user: User | null;
  fallbackName: string;
  saving?: boolean;
  onUpdate: ProfileCardProps["onUpdate"];
  onDone: () => void;
}) {
  const {
    register,
    control,
    onSubmit,
    formError,
    formState: { errors },
  } = useServerForm<ProfileInfoFormInput>({
    schema: profileInfoFormSchema,
    defaultValues: {
      name: user?.name ?? fallbackName,
      email: user?.email ?? "",
      mobile: user?.mobile ?? "",
    },
    // A blank field is left unchanged, as before: the profile update has no "clear" operation.
    submit: (data) =>
      onUpdate({
        name: data.name || undefined,
        email: data.email || undefined,
        mobile: data.mobile || undefined,
      }),
    onSuccess: onDone,
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-xs">
      {formError && (
        <div
          role="alert"
          className="rounded-field border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {formError}
        </div>
      )}
      <FormInput
        label={PROFILE_CARD_COPY.name}
        placeholder={PROFILE_CARD_COPY.yourName}
        autoComplete="name"
        {...register("name")}
        error={errors.name?.message}
      />
      <FormInput
        label={PROFILE_CARD_COPY.email}
        type="email"
        placeholder={PROFILE_CARD_COPY.emailCom}
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />
      <FormPhoneInput
        name="mobile"
        control={control}
        label={PROFILE_CARD_COPY.mobileNumber}
        placeholder={PROFILE_CARD_COPY.mobileNumber2}
      />
      <div className="flex gap-2">
        <ChangePasswordModal />
      </div>
      <FormActions
        onCancel={onDone}
        isSubmitting={saving}
        submitLabel={PROFILE_CARD_COPY.save}
        cancelLabel={PROFILE_CARD_COPY.cancel}
      />
    </form>
  );
}
