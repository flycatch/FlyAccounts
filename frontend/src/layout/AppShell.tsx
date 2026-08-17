import { useState, type ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import "./AppShell.css";

export type SettingsView = "home" | "users" | "roles" | "permissions";

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
      <main className="app-shell-main">{children}</main>
    </div>
  );
}
