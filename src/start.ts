import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
// This app uses its own evopay session token (see evopaySessionMiddleware below).

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

const evopaySessionMiddleware = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("evopay-session-token") : null;
  return next({
    headers: token ? { "x-evopay-session": token } : undefined,
  });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [evopaySessionMiddleware],
}));
