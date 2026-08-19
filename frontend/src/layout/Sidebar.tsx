import brandIcon from "../assets/icons/sms-tracking.svg";

type SidebarProps = {
  pathname: string;
  showSettings: boolean;
  canUsers: boolean;
  canRoles: boolean;
  canPermissions: boolean;
  canContracts: boolean;
  open?: boolean;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
};

export function Sidebar({
  pathname,
  showSettings,
  canUsers,
  canRoles,
  canPermissions,
  canContracts,
  open = false,
  onNavigate,
  onSignOut,
}: SidebarProps) {
  const homeActive = pathname === "/";
  const contractsActive = pathname.startsWith("/contracts");
  const clientsActive = pathname.startsWith("/clients");
  const resourcesActive = pathname.startsWith("/resources");
  return (
    <aside className={`app-shell-sidebar${open ? " is-open" : ""}`} id="app-sidebar">
      <p className="app-shell-brand">
        <img src={brandIcon} width={24} height={24} alt="" />
        FlyAccounts
      </p>
      <nav className="app-shell-nav" aria-label="Application">
        <button
          type="button"
          className={`app-shell-nav-item${homeActive ? " is-active" : ""}`}
          onClick={() => onNavigate("/")}
        >
          Home
        </button>
        {canContracts ? (
          <>
            <button
              type="button"
              className={`app-shell-nav-item${clientsActive ? " is-active" : ""}`}
              onClick={() => onNavigate("/clients")}
            >
              Clients
            </button>
            <button
              type="button"
              className={`app-shell-nav-item${resourcesActive ? " is-active" : ""}`}
              onClick={() => onNavigate("/resources")}
            >
              Resources
            </button>
            <button
              type="button"
              className={`app-shell-nav-item${contractsActive ? " is-active" : ""}`}
              onClick={() => onNavigate("/contracts")}
            >
              Contracts
            </button>
          </>
        ) : null}
        {showSettings ? (
          <>
            <p className="app-shell-nav-group">Settings</p>
            {canUsers ? (
              <button
                type="button"
                className={`app-shell-nav-item${pathname.startsWith("/settings/users") ? " is-active" : ""}`}
                onClick={() => onNavigate("/settings/users")}
              >
                Users
              </button>
            ) : null}
            {canRoles ? (
              <button
                type="button"
                className={`app-shell-nav-item${pathname.startsWith("/settings/roles") ? " is-active" : ""}`}
                onClick={() => onNavigate("/settings/roles")}
              >
                Roles
              </button>
            ) : null}
            {canPermissions ? (
              <button
                type="button"
                className={`app-shell-nav-item${pathname.startsWith("/settings/permissions") ? " is-active" : ""}`}
                onClick={() => onNavigate("/settings/permissions")}
              >
                Permissions
              </button>
            ) : null}
          </>
        ) : null}
      </nav>
      <button type="button" className="app-shell-sign-out" onClick={onSignOut}>
        Sign out
      </button>
    </aside>
  );
}
