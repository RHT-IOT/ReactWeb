"use client";

import { AuthProvider } from "react-oidc-context";
import { getOidcConfig } from "./authConfig";

export default function OidcProvider({ children }: { children: React.ReactNode }) {
  const config = getOidcConfig();
  return <AuthProvider {...config}>{children}</AuthProvider>;
}
