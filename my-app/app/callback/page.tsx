"use client";

import { useEffect } from "react";
import { useAuth } from "react-oidc-context";

export default function CallbackPage() {
  const auth = useAuth();

  useEffect(() => {
    // react-oidc-context will automatically handle the redirect
    // and update auth state. You can redirect to home after login.
    if (auth.isAuthenticated) {
      window.location.replace("/");
    }
  }, [auth.isAuthenticated]);

  return <p>Finishing login...</p>;
}
