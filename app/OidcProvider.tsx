"use client";

import { AuthProvider } from "react-oidc-context";
import { oidcConfig } from "./authConfig";

export default function OidcProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider {...oidcConfig}>{children}</AuthProvider>;
}
