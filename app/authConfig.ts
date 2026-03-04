import { PublicClientApplication } from "@azure/msal-browser";
export type OidcConfig = {
  authority: string;
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  cognito_domain?: string;
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const IS_PROD = process.env.NODE_ENV === 'production';

const devConfig: OidcConfig = {
  authority: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_d19WijVBp',
  client_id: '7bj6qolgca3bbcshiuiinp9tj4',
  redirect_uri: 'http://localhost:3000/login/',
  response_type: 'code',
  scope: 'email openid phone',
  cognito_domain: 'https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com',
};

const prodConfigEnv: Partial<OidcConfig> = {
  authority: 'https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_d19WijVBp',
  client_id: '3onjp69um7f992j8hqj0nd9q7f',
  redirect_uri: 'https://rht-iot.github.io/ReactWeb/login',
  response_type: 'code',
  scope: 'email openid phone',
  cognito_domain: 'https://ap-southeast-2d19wijvbp.auth.ap-southeast-2.amazoncognito.com',
};

const prodConfig: OidcConfig = {
  authority: prodConfigEnv.authority || devConfig.authority,
  client_id: prodConfigEnv.client_id || devConfig.client_id,
  // Compute redirect dynamically if not provided via env
  redirect_uri:
    prodConfigEnv.redirect_uri ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}${BASE_PATH}/login/`
      : `${BASE_PATH}/login/`),
  response_type: prodConfigEnv.response_type || devConfig.response_type,
  scope: prodConfigEnv.scope || devConfig.scope,
  cognito_domain: prodConfigEnv.cognito_domain || devConfig.cognito_domain,
};

export function getOidcConfig(): OidcConfig {
  return IS_PROD ? prodConfig : devConfig;
}

export function buildLogoutUrl(config: OidcConfig): string | null {
  const domain = config.cognito_domain;
  if (!domain) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoutUri = `${origin}${BASE_PATH}/`;
  return `${domain}/logout?client_id=${config.client_id}&logout_uri=${encodeURIComponent(logoutUri)}`;
}

export const msalConfig = {
  auth: {
    clientId: "231cd4ed-db1c-413d-ab9c-643a61712ee8", // Application (client) ID
    authority: "https://login.microsoftonline.com/6cb89794-7b66-472d-b0b1-09ed68dafe30", // Tenant ID
    redirectUri: "https://rht-iot.github.io/ReactWeb/admin", // must match Azure portal
  }
};

export const loginRequest = {
  scopes: ["User.Read", "Files.ReadWrite"] // Graph scopes
};

export const msalInstance = new PublicClientApplication(msalConfig);

let msalInitPromise: Promise<void> | null = null;
export function initializeMsal() {
  if (!msalInitPromise) {
    msalInitPromise = msalInstance.initialize();
  }
  return msalInitPromise;
}
