import brandIcon from "../assets/icons/sms-tracking.svg";

type SettingsView = "home" | "users" | "roles" | "permissions";

type SidebarProps = {
  current: SettingsView;
  showSettings: boolean;
  open?: boolean;
  onNavigate: (view: SettingsView) => void;
  onSignOut: () => void;
};

export function Sidebar({ current, showSettings, open = false, onNavigate, onSignOut }: SidebarProps) {
  return (
    <aside className={`app-shell-sidebar${open ? " is-open" : ""}`} id="app-sidebar">
      <p className="app-shell-brand">
        <img src={brandIcon} width={24} height={24} alt="" />
        FlyAccounts
      </p>
      <nav className="app-shell-nav" aria-label="Application">
        <button
          type="button"
          className={`app-shell-nav-item${current === "home" ? " is-active" : ""}`}
          onClick={() => onNavigate("home")}
        >
          Home
        </button>
        {showSettings ? (
          <>
            <p className="app-shell-nav-group">Settings</p>
            <button
              type="button"
              className={`app-shell-nav-item${current === "users" ? " is-active" : ""}`}
              onClick={() => onNavigate("users")}
            >
              Users
            </button>
            <button
              type="button"
              className={`app-shell-nav-item${current === "roles" ? " is-active" : ""}`}
              onClick={() => onNavigate("roles")}
            >
              Roles
            </button>
            <button
              type="button"
              className={`app-shell-nav-item${current === "permissions" ? " is-active" : ""}`}
              onClick={() => onNavigate("permissions")}
            >
              Permissions
            </button>
          </>
        ) : null}
      </nav>
      <button type="button" className="app-shell-sign-out" onClick={onSignOut}>
        Sign out
      </button>
    </aside>
  );
}
