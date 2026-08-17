import { useState } from "react";

import { apiClient } from "../api/client";
import { loginWithMicrosoft } from "../auth/msal";
import { storeTokens } from "../auth/tokens";
import "./SignInPage.css";

type SignInPageProps = {
  onSignedIn: () => void;
};

export function SignInPage({ onSignedIn }: SignInPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      const idToken = await loginWithMicrosoft();
      const { data, error: apiError, response } = await apiClient.POST("/auth/microsoft", {
        body: { idToken },
      });
      if (apiError || !response.ok || !data) {
        setError("Sign-in was cancelled or could not be completed.");
        return;
      }
      storeTokens(data.accessToken, data.refreshToken);
      onSignedIn();
    } catch {
      setError("Sign-in was cancelled or could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sign-in-page">
      <div className="sign-in-panel">
        <p className="sign-in-brand">FlyAccounts</p>
        <p className="sign-in-copy">
          Sign in with your organizational Microsoft work or school account to continue.
        </p>
        <button
          type="button"
          className="sign-in-cta"
          onClick={() => void handleSignIn()}
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in with Microsoft"}
        </button>
        {error ? (
          <p className="sign-in-alert" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
