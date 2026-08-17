import { useState, type ReactNode } from "react";

import { PageHeader } from "./PageHeader";
import { Sidebar } from "./Sidebar";
import "./AppShell.css";

export type SettingsView = "home" | "users" | "roles" | "permissions";

const PAGE_TITLES: Record<SettingsView, string> = {
  home: "Home",
  users: "Users",
  roles: "Roles",
  permissions: "Permissions",
};

type AppShellProps = {
  current: SettingsView;
  showSettings: boolean;
  onNavigate: (view: SettingsView) => void;
  onSignOut: () => void;
  children: ReactNode;
};

export function AppShell({ current, showSettings, onNavigate, onSignOut, children }: AppShellProps) {
  const [open, setOpen] = useState(false);

  function navigate(view: SettingsView) {
    onNavigate(view);
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
        current={current}
        showSettings={showSettings}
        open={open}
        onNavigate={navigate}
        onSignOut={onSignOut}
      />
      <main className="app-shell-content">
        <div className="app-shell-header-wrap">
          <PageHeader title={PAGE_TITLES[current]} />
        </div>
        <div className="app-shell-main">{children}</div>
      </main>
    </div>
  );
}
