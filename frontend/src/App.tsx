import { useCallback, useEffect, useState } from "react";

import type { components } from "./api/schema";
import { apiClient } from "./api/client";
import { getAccessToken, getRefreshToken, signOut } from "./auth/tokens";
import { AppShell, type SettingsView } from "./layout/AppShell";
import { CombinedLandingPage } from "./pages/CombinedLandingPage";
import { PendingAccessPage } from "./pages/PendingAccessPage";
import { SignInPage } from "./pages/SignInPage";
import { PermissionsPage } from "./pages/settings/PermissionsPage";
import { RolesPage } from "./pages/settings/RolesPage";
import { UsersPage } from "./pages/settings/UsersPage";
import "./pages/SignInPage.css";

type MeResponse = components["schemas"]["MeResponse"];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [view, setView] = useState<SettingsView>("home");

  const loadSession = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      setMe(null);
      setView("home");
      setLoading(false);
      return;
    }
    const { data, error, response } = await apiClient.GET("/me");
    if (error || !response.ok || !data) {
      setMe(null);
      setView("home");
      setLoading(false);
      return;
    }
    setMe(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  async function handleSignOut() {
    await signOut();
    setView("home");
    await loadSession();
  }

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

  const canOpenSettings = me.permissions.includes("access_administration");
  const current = canOpenSettings ? view : "home";

  return (
    <AppShell
      current={current}
      showSettings={canOpenSettings}
      onNavigate={(next) => {
        if (next !== "home" && !canOpenSettings) {
          setView("home");
          return;
        }
        setView(next);
      }}
      onSignOut={() => void handleSignOut()}
    >
      {current === "users" ? <UsersPage /> : null}
      {current === "roles" ? <RolesPage /> : null}
      {current === "permissions" ? <PermissionsPage /> : null}
      {current === "home" ? (
        <CombinedLandingPage me={me} onSignedOut={() => void handleSignOut()} />
      ) : null}
    </AppShell>
  );
}
