import { PublicClientApplication } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_MICROSOFT_TENANT_ID ?? "";
const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID ?? "";

const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:8080",
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
});

let initializePromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initializePromise) {
    initializePromise = msalInstance.initialize().then(() => undefined);
  }
  await initializePromise;
}

export async function loginWithMicrosoft(): Promise<string> {
  await ensureInitialized();
  const result = await msalInstance.loginPopup({
    scopes: ["openid", "profile"],
  });
  if (!result.idToken) {
    throw new Error("Microsoft sign-in did not return an ID token.");
  }
  return result.idToken;
}
