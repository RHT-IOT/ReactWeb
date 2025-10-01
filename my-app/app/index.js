// index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { oidcConfig } from "./authConfig";
import { AuthProvider } from "react-oidc-context";


const root = ReactDOM.createRoot(document.getElementById("root"));

// wrap the application with AuthProvider
root.render(
  <React.StrictMode>
    <AuthProvider {...oidcConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);