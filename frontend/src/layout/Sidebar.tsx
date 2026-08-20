import brandIcon from "../assets/icons/sms-tracking.svg";

type SidebarProps = {
  pathname: string;
  showSettings: boolean;
  canUsers: boolean;
  canRoles: boolean;
  canPermissions: boolean;
  canClients: boolean;
  canResources: boolean;
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
  canClients,
  canResources,
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
        {canClients ? (
          <button
            type="button"
            className={`app-shell-nav-item${clientsActive ? " is-active" : ""}`}
            onClick={() => onNavigate("/clients")}
          >
            Clients
          </button>
        ) : null}
        {canResources ? (
          <button
            type="button"
            className={`app-shell-nav-item${resourcesActive ? " is-active" : ""}`}
            onClick={() => onNavigate("/resources")}
          >
            Resources
          </button>
        ) : null}
        {canContracts ? (
          <button
            type="button"
            className={`app-shell-nav-item${contractsActive ? " is-active" : ""}`}
            onClick={() => onNavigate("/contracts")}
          >
            Contracts
          </button>
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: "4px" }}
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </aside>
  );
}
