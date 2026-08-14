import { useCallback, useEffect, useState } from "react";

import type { components } from "./api/schema";
import { apiClient } from "./api/client";
import { getAccessToken, getRefreshToken } from "./auth/tokens";
import { AccessAdminPage } from "./pages/AccessAdminPage";
import { CombinedLandingPage } from "./pages/CombinedLandingPage";
import { PendingAccessPage } from "./pages/PendingAccessPage";
import { SignInPage } from "./pages/SignInPage";
import "./pages/SignInPage.css";

type MeResponse = components["schemas"]["MeResponse"];
type View = "landing" | "admin";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [view, setView] = useState<View>("landing");

  const loadSession = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      setMe(null);
      setView("landing");
      setLoading(false);
      return;
    }
    const { data, error, response } = await apiClient.GET("/me");
    if (error || !response.ok || !data) {
      setMe(null);
      setView("landing");
      setLoading(false);
      return;
    }
    setMe(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <main className="app-page">
        <h1>FlyAccounts</h1>
        <p>Loading…</p>
      </main>
    );
  }

  if (!me) {
    return <SignInPage onSignedIn={() => void loadSession()} />;
  }

  if (me.landing.accessState === "pending") {
    return <PendingAccessPage onSignedOut={() => void loadSession()} />;
  }

  if (view === "admin" && me.permissions.includes("access_administration")) {
    return (
      <AccessAdminPage
        onBack={() => {
          setView("landing");
          void loadSession();
        }}
      />
    );
  }

  return (
    <CombinedLandingPage
      me={me}
      onOpenAdmin={
        me.permissions.includes("access_administration")
          ? () => {
              setView("admin");
            }
          : undefined
      }
      onSignedOut={() => void loadSession()}
    />
  );
}
