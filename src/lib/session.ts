// Shared session config. Read env inside handlers, not at module scope.

export type SessionData = {
  userId?: string;
  role?: "admin" | "funcionario" | "cliente";
};

export function getSessionConfig() {
  // sameSite=None + Secure so the cookie survives inside the Lovable preview
  // iframe (embedded on a different origin). Modern Chrome drops Lax cookies
  // written from a third-party iframe, which broke "stay logged in" after login.
  return {
    password: process.env.SESSION_SECRET ?? "dev-only-session-secret-please-change-in-production-32chars",
    name: "evopay-session",
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      path: "/",
    },
  };
}
