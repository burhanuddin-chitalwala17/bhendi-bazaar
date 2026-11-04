import type { AuthView } from "@/components/auth/auth-view";
/** The sign-in, sign-up and password forms' words, on the page and in the sheet (ADR-0067). */
export const AUTH_COPY = {
  or: "or",
  close: "Close",
  email: "Email",
  emailPlaceholder: "your@email.com",
  password: "Password",
  name: "Name",
  showPassword: "Show password",
  hidePassword: "Hide password",
  continueWithGoogle: "Continue with Google",
  signIn: "Sign in",
  signingIn: "Signing in...",
  signInFailed: "Invalid email or password.",
  forgotPassword: "Forgot password?",
  newHere: "New to Bhendi Bazaar?",
  createAnAccount: "Create an account",
  createAccount: "Create account",
  creatingAccount: "Creating account...",
  haveAccount: "Already have an account?",
  backToSignIn: "Back to sign in",
  checkInbox: "Check your inbox",
  resetLinkSent: "If an account exists with this email, you'll receive a password reset link shortly.",
  sendResetLink: "Send reset link",
  sending: "Sending...",
  newPassword: "New password",
  confirmPassword: "Confirm password",
  passwordRules: "At least 8 characters with uppercase, lowercase, a number and a symbol",
  resetPassword: "Reset password",
  resetting: "Resetting…",
  passwordResetDone: "Password reset",
  passwordChanged: "Your password has been changed. Taking you to sign in…",
} as const;

/** The reset-password page around the form. */
export const RESET_PAGE_COPY = {
  invalidTitle: "Invalid reset link",
  invalidBody: "This password reset link is invalid or has expired.",
  requestNew: "Request new link",
  eyebrow: "Reset password",
  title: "Create new password",
  description: "Enter your new password below.",
} as const;

export const AUTH_VIEW_COPY: Record<
  AuthView,
  { eyebrow: string; title: string; description: string }
> = {
  signin: {
    eyebrow: "Sign in",
    title: "Welcome back to Bhendi Bazaar",
    description:
      "Sign in to see your orders and enjoy a faster checkout. You can still shop as a guest without an account.",
  },
  signup: {
    eyebrow: "Sign up",
    title: "Join the Bhendi Bazaar circle",
    description:
      "Create an account to save your details and view your orders. You can still complete purchases as a guest anytime.",
  },
  forgot: {
    eyebrow: "Forgot password",
    title: "Reset your password",
    description:
      "Enter your email and we'll send you a link to reset your password.",
  },
};

export const AUTH_SHEET_COPY = {
  signin: "Sign in",
  signup: "Create an account",
  forgot: "Forgot password",
} as const;

export const SIGN_IN_BUTTON_COPY = {
  label: "Sign in",
} as const;
