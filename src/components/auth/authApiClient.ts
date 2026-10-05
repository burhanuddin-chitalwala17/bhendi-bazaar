import { apiRequest } from "@/lib/api-client";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  SignupInput,
} from "@/lib/validation/schemas/auth.schemas";

interface MessageResponse {
  message: string;
}

/** Account requests the browser makes outside next-auth's own sign-in handler. */
export const authApiClient = {
  forgotPassword: (data: ForgotPasswordInput) =>
    apiRequest<MessageResponse>("/api/auth/forgot-password", { method: "POST", body: data }),

  resetPassword: (data: ResetPasswordInput) =>
    apiRequest<MessageResponse>("/api/auth/reset-password", { method: "POST", body: data }),

  signUp: (data: SignupInput) =>
    apiRequest<unknown>("/api/auth/signup", { method: "POST", body: data }),

  changePassword: (data: ChangePasswordInput) =>
    apiRequest<MessageResponse>("/api/auth/change-password", { method: "POST", body: data }),

  resendVerification: () =>
    apiRequest<MessageResponse>("/api/auth/resend-verification", { method: "POST" }),
};
