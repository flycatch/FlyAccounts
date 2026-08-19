import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import type { components } from "./api/schema";
import { apiClient } from "./api/client";
import { getAccessToken, getRefreshToken, signOut } from "./auth/tokens";
import { EntityProvider } from "./entity/EntityContext";
import { AppShell } from "./layout/AppShell";
import { ClientsPage } from "./pages/clients/ClientsPage";
import { CombinedLandingPage } from "./pages/CombinedLandingPage";
import { ContractDetailPage } from "./pages/contracts/ContractDetailPage";
import { ContractEditPage } from "./pages/contracts/ContractEditPage";
import { ContractsPage } from "./pages/contracts/ContractsPage";
import { Step1UploadPage } from "./pages/contracts/create/Step1UploadPage";
import { Step2ClosurePage } from "./pages/contracts/create/Step2ClosurePage";
import { Step3PaymentPage } from "./pages/contracts/create/Step3PaymentPage";
import { PendingAccessPage } from "./pages/PendingAccessPage";
import { SignInPage } from "./pages/SignInPage";
import { PermissionsPage } from "./pages/settings/PermissionsPage";
import { RolesPage } from "./pages/settings/RolesPage";
import { UsersPage } from "./pages/settings/UsersPage";
import { ToastProvider } from "./toast/ToastProvider";
import "./pages/SignInPage.css";

type MeResponse = components["schemas"]["MeResponse"];

function SettingsGate({
  me,
  permission,
  children,
}: {
  me: MeResponse;
  permission: string;
  children: ReactNode;
}) {
  if (!me.permissions.includes(permission)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AuthorizedApp({ me, onSignOut }: { me: MeResponse; onSignOut: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const canUsers = me.permissions.includes("manage_users");
  const canRoles = me.permissions.includes("manage_roles");
  const canPermissions = me.permissions.includes("manage_permissions");
  const canContracts = me.permissions.includes("manage_contracts");
  const showSettings = canUsers || canRoles || canPermissions;

  return (
    <EntityProvider>
      <ToastProvider>
        <AppShell
          pathname={location.pathname}
          showSettings={showSettings}
          canUsers={canUsers}
          canRoles={canRoles}
          canPermissions={canPermissions}
          canContracts={canContracts}
          onNavigate={(path) => navigate(path)}
          onSignOut={onSignOut}
        >
          <Routes>
            <Route path="/" element={<CombinedLandingPage me={me} />} />
            <Route
              path="/clients"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <ClientsPage />
                </SettingsGate>
              }
            />
            <Route
              path="/contracts"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <ContractsPage me={me} />
                </SettingsGate>
              }
            />
            <Route
              path="/contracts/new"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <Step1UploadPage me={me} />
                </SettingsGate>
              }
            />
            <Route
              path="/contracts/:contractId/setup/1"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <Step1UploadPage me={me} />
                </SettingsGate>
              }
            />
            <Route
              path="/contracts/:contractId/setup/2"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <Step2ClosurePage me={me} />
                </SettingsGate>
              }
            />
            <Route
              path="/contracts/:contractId/setup/3"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <Step3PaymentPage me={me} />
                </SettingsGate>
              }
            />
            <Route
              path="/contracts/:contractId/edit"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <ContractEditPage me={me} />
                </SettingsGate>
              }
            />
            <Route
              path="/contracts/:contractId"
              element={
                <SettingsGate me={me} permission="manage_contracts">
                  <ContractDetailPage me={me} />
                </SettingsGate>
              }
            />
            <Route
              path="/settings/users"
              element={
                <SettingsGate me={me} permission="manage_users">
                  <UsersPage />
                </SettingsGate>
              }
            />
            <Route
              path="/settings/roles"
              element={
                <SettingsGate me={me} permission="manage_roles">
                  <RolesPage />
                </SettingsGate>
              }
            />
            <Route
              path="/settings/permissions"
              element={
                <SettingsGate me={me} permission="manage_permissions">
                  <PermissionsPage />
                </SettingsGate>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </ToastProvider>
    </EntityProvider>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  const loadSession = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      setMe(null);
      setLoading(false);
      return;
    }
    const { data, error, response } = await apiClient.GET("/me");
    if (error || !response.ok || !data) {
      setMe(null);
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

  return (
    <BrowserRouter>
      <AuthorizedApp me={me} onSignOut={() => void handleSignOut()} />
    </BrowserRouter>
  );
}
