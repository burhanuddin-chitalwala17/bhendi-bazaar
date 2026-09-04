"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import type {
  DeliveryAddress,
  ProfileData,
  UpdateProfileInput,
  User,
  UserProfile,
} from "@/domain/profile";

interface ProfileContextValue {
  // Data
  user: User | null;
  profile: UserProfile | null;
  isEmailVerified: boolean;

  // State
  loading: boolean;
  error: string | null;
  saving: boolean;

  // Actions
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  updateUserInfo: (input: {
    name?: string;
    email?: string;
    mobile?: string;
    currentPassword?: string;
  }) => Promise<void>;
  updateProfilePic: (profilePic: string) => Promise<void>;
  refetch: () => Promise<void>;

  // Email verification
  resendVerificationEmail: () => Promise<{ success: boolean; message: string }>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(
  undefined
);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/profile", {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized - please sign in");
        }
        throw new Error(`Failed to load profile: ${response.statusText}`);
      }

      const profileData = await response.json();
      setData(profileData);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your profile right now."
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch profile on mount or when auth status changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    } else {
      setData(null);
      setError(null);
    }
  }, [isAuthenticated, fetchProfile]);

  // Generic update function
  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!data) {
        throw new Error("No profile data loaded");
      }
      const originalData = data;

      try {
        setSaving(true);
        setError(null);

        // Optimistic update - update UI immediately
        const optimisticData: ProfileData = {
          user: { ...data.user },
          profile: { ...data.profile },
        };

        if (input.name !== undefined) optimisticData.user.name = input.name;
        if (input.email !== undefined) {
          optimisticData.user.email = input.email;
          // If email changed, mark as unverified
          if (input.email !== data.user.email) {
            optimisticData.user.isEmailVerified = false;
          }
        }
        if (input.mobile !== undefined)
          optimisticData.user.mobile = input.mobile;
        if (input.addresses !== undefined)
          optimisticData.profile.addresses = input.addresses;
        if (input.profilePic !== undefined)
          optimisticData.profile.profilePic = input.profilePic;

        setData(optimisticData);

        // Make API call
        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          // Revert optimistic update on error
          setData(originalData);

          if (response.status === 401) {
            throw new Error("Unauthorized - please sign in");
          }
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update profile");
        }

        const updated = await response.json();
        setData(updated);
      } catch (err) {
        console.error("Failed to update profile:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Unable to save changes. Please try again.";
        setError(errorMessage);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [data]
  );

  // Resend verification email
  const resendVerificationEmail = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: result.message || "Verification email sent!",
        };
      } else {
        return {
          success: false,
          message: result.error || "Failed to send verification email",
        };
      }
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      return {
        success: false,
        message: "Failed to send verification email. Please try again.",
      };
    }
  }, []);

  const updateUserInfo = useCallback(
    async (input: {
      name?: string;
      email?: string;
      mobile?: string;
      currentPassword?: string;
    }) => {
      await updateProfile(input);
    },
    [updateProfile]
  );

  const updateProfilePic = useCallback(
    async (profilePic: string) => {
      await updateProfile({ profilePic });
    },
    [updateProfile]
  );

  const value: ProfileContextValue = {
    user: data?.user ?? null,
    profile: data?.profile ?? null,
    isEmailVerified: data?.user?.isEmailVerified ?? false,
    loading,
    error,
    saving,
    updateProfile,
    updateUserInfo,
    updateProfilePic,
    refetch: fetchProfile,
    resendVerificationEmail,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

// Custom hook to use the profile context
export function useProfileContext(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfileContext must be used within a ProfileProvider");
  }
  return context;
}