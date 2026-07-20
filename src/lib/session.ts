// Shared session config. Read env inside handlers, not at module scope.

export type SessionData = {
  userId?: string;
  role?: "admin" | "funcionario";
};

export function getSessionConfig() {
  return {
    password: process.env.SESSION_SECRET ?? "dev-only-session-secret-please-change-in-production-32chars",
    name: "evopay-session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: (process.env.NODE_ENV ?? "development") === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  };
}
