"use client";

import { useId, useState } from "react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { authApiClient } from "@/components/auth/authApiClient";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validation/schemas/auth.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { CHANGE_PASSWORD_MODAL_COPY } from "./profile-copy";

export function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [success, setSuccess] = useState(false);
  const id = useId();

  const {
    register,
    onSubmit,
    formError,
    reset,
    formState: { errors, isSubmitting },
  } = useServerForm<ChangePasswordInput>({
    schema: changePasswordSchema,
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    submit: (data) => authApiClient.changePassword(data),
    onSuccess: () => {
      setSuccess(true);
      reset();
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 2000);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full text-2xs font-semibold uppercase tracking-eyebrow"
        >
          <Icon name="key" size="xs" className="mr-1" />{CHANGE_PASSWORD_MODAL_COPY.changePassword}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{CHANGE_PASSWORD_MODAL_COPY.changePassword}</DialogTitle>
          <DialogDescription>{CHANGE_PASSWORD_MODAL_COPY.enterCurrentPasswordChoose}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label variant="eyebrow" htmlFor={`${id}-current`} className="text-xs">{CHANGE_PASSWORD_MODAL_COPY.currentPassword}</Label>
            <div className="relative">
              <Input
                id={`${id}-current`}
                type={showPasswords ? "text" : "password"}
                {...register("currentPassword")}
              />
              {errors.currentPassword && (
                <p role="alert" className="text-xs text-destructive">
                  {errors.currentPassword.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label variant="eyebrow" htmlFor={`${id}-new`} className="text-xs">{CHANGE_PASSWORD_MODAL_COPY.newPassword}</Label>
            <Input
              id={`${id}-new`}
              type={showPasswords ? "text" : "password"}
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p role="alert" className="text-xs text-destructive">
                {errors.newPassword.message}
              </p>
            )}
            <p className="text-2xs text-muted-foreground">{CHANGE_PASSWORD_MODAL_COPY.least8CharactersUppercase}</p>
          </div>

          <div className="space-y-2">
            <Label variant="eyebrow" htmlFor={`${id}-confirm`} className="text-xs">{CHANGE_PASSWORD_MODAL_COPY.confirmNewPassword}</Label>
            <Input
              id={`${id}-confirm`}
              type={showPasswords ? "text" : "password"}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p role="alert" className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="-mx-2 flex min-h-10 items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showPasswords ? (
              <>
                <Icon name="hide" size="sm" />{CHANGE_PASSWORD_MODAL_COPY.hidePasswords}</>
            ) : (
              <>
                <Icon name="show" size="sm" />{CHANGE_PASSWORD_MODAL_COPY.showPasswords}</>
            )}
          </Button>

          {formError && (
            <p
              role="alert"
              className="text-sm text-destructive bg-destructive/10 p-3 rounded-md"
            >
              {formError}
            </p>
          )}

          {success && (
            <p className="text-sm text-success bg-success/10 p-3 rounded-md">{CHANGE_PASSWORD_MODAL_COPY.passwordChangedSuccessfully}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >{CHANGE_PASSWORD_MODAL_COPY.cancel}</Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? CHANGE_PASSWORD_MODAL_COPY.changing : CHANGE_PASSWORD_MODAL_COPY.changePassword}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
