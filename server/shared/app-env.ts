/**
 * The environment, named by the application (ADR-0037 D2). `local` is the default when
 * nothing says otherwise and the process is not a production build; a production build
 * with no `APP_ENV` is a deployment mistake and refuses to guess.
 */
export const APP_ENVS = ["local", "preview", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

function isAppEnv(value: string | undefined): value is AppEnv {
  return (APP_ENVS as readonly string[]).includes(value ?? "");
}

export function appEnv(): AppEnv {
  const value = process.env.APP_ENV;
  if (isAppEnv(value)) return value;
  if (value !== undefined) throw new Error(`APP_ENV must be one of ${APP_ENVS.join(", ")}; got "${value}"`);
  if (process.env.NODE_ENV === "production") throw new Error("APP_ENV is not set");
  return "local";
}
