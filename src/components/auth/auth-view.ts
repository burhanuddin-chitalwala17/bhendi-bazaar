/** The three forms the auth pages and the auth sheet share (seamless-sign-in D1). */
export const AUTH_VIEWS = ["signin", "signup", "forgot"] as const;
export type AuthView = (typeof AUTH_VIEWS)[number];

/** What a form hands its host along with a view switch — D4's filled-in email. */
export interface AuthViewSwitch {
  email?: string;
}

export type SwitchAuthView = (view: AuthView, detail?: AuthViewSwitch) => void;

export const AUTH_VIEW_PATHS: Record<AuthView, string> = {
  signin: "/signin",
  signup: "/signup",
  forgot: "/forgot-password",
};

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
