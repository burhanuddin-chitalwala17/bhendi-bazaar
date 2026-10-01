import { apiRequest } from "@/lib/api-client";
import type { UpdateProfileInput } from "@/domain/profile";

export const profileApiClient = {
  updateProfile(input: UpdateProfileInput): Promise<void> {
    return apiRequest("/api/profile", { method: "PUT", body: input });
  },
};
