import { useState, type ReactNode } from "react";

import { PageHeader } from "./PageHeader";
import { Sidebar } from "./Sidebar";
import "./AppShell.css";

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/settings/users")) {
    return "Users";
  }
  if (pathname.startsWith("/settings/roles")) {
    return "Roles";
  }
  if (pathname.startsWith("/settings/permissions")) {
    return "Permissions";
  }
  return "Home";
}

type AppShellProps = {
  pathname: string;
  showSettings: boolean;
  canUsers: boolean;
  canRoles: boolean;
  canPermissions: boolean;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
  children: ReactNode;
};

export function AppShell({
  pathname,
  showSettings,
  canUsers,
  canRoles,
  canPermissions,
  onNavigate,
  onSignOut,
  children,
}: AppShellProps) {
  const [open, setOpen] = useState(false);

  function navigate(path: string) {
    onNavigate(path);
    setOpen(false);
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className="app-shell-toggle"
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      <Sidebar
        pathname={pathname}
        showSettings={showSettings}
        canUsers={canUsers}
        canRoles={canRoles}
        canPermissions={canPermissions}
        open={open}
        onNavigate={navigate}
        onSignOut={onSignOut}
      />
      <main className="app-shell-content">
        <div className="app-shell-header-wrap">
          <PageHeader title={titleForPath(pathname)} />
        </div>
        <div className="app-shell-main">{children}</div>
      </main>
    </div>
  );
}
