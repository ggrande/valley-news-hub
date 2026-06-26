// Isomorphic helper: returns a redirect path if the current request host is a
// tenant subdomain trying to reach master /admin or /account, else null.
import { createIsomorphicFn } from "@tanstack/react-start";

export const getTenantRedirectTarget = createIsomorphicFn()
  .client((_pathname: string) => null as string | null)
  .server((pathname: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getRequest } = require("@tanstack/react-start/server") as typeof import("@tanstack/react-start/server");
      const req = getRequest();
      const host = req?.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
      const isTenantHost =
        host.endsWith(".wkna49.com") && host !== "www.wkna49.com" && host !== "wkna49.com";
      if (!isTenantHost) return null;
      if (pathname === "/admin" || pathname.startsWith("/admin/") ||
          pathname === "/account" || pathname.startsWith("/account/")) {
        return "/station/admin";
      }
      return null;
    } catch {
      return null;
    }
  });
