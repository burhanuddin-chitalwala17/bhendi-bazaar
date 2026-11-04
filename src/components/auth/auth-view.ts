import { ROUTES } from "@server/shared/routes";
export { AUTH_VIEW_COPY } from "@/components/auth/auth-copy";

/** The three forms the auth pages and the auth sheet share (seamless-sign-in D1). */
export const AUTH_VIEWS = ["signin", "signup", "forgot"] as const;
export type AuthView = (typeof AUTH_VIEWS)[number];

/** What a form hands its host along with a view switch — D4's filled-in email. */
export interface AuthViewSwitch {
  email?: string;
}

export type SwitchAuthView = (view: AuthView, detail?: AuthViewSwitch) => void;

export const AUTH_VIEW_PATHS: Record<AuthView, string> = {
  signin: ROUTES.signIn,
  signup: ROUTES.signUp,
  forgot: ROUTES.forgotPassword,
};

/** What a form calls once it has signed the person in. */
export type AuthDone = () => void | Promise<void>;

