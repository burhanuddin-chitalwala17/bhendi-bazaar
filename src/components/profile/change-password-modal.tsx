"use client";

import { useState } from "react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/schemas/auth.schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key, Eye, EyeOff } from "lucide-react";

export function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    onSubmit,
    formError,
    reset,
    formState: { errors, isSubmitting },
  } = useServerForm<ChangePasswordInput>({
    schema: changePasswordSchema,
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    submit: async (data) => {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await readApiError(response);
      return response.json();
    },
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
          className="rounded-full text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
        >
          <Key className="mr-1 h-3 w-3" />
          Change Password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em]">
              Current Password
            </label>
            <div className="relative">
              <Input
                type={showPasswords ? "text" : "password"}
                {...register("currentPassword")}
              />
            {errors.currentPassword && (
              <p role="alert" className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em]">
              New Password
            </label>
            <Input
              type={showPasswords ? "text" : "password"}
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p role="alert" className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
            <p className="text-[0.65rem] text-muted-foreground">
              At least 8 characters with uppercase, lowercase, and numbers
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em]">
              Confirm New Password
            </label>
            <Input
              type={showPasswords ? "text" : "password"}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p role="alert" className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            {showPasswords ? (
              <>
                <EyeOff className="h-3 w-3" /> Hide passwords
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" /> Show passwords
              </>
            )}
          </button>

          {formError && (
            <p role="alert" className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {formError}
            </p>
          )}

          {success && (
            <p className="text-sm text-success bg-success/10 p-3 rounded-md">
              Password changed successfully!
            </p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}