import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

const get = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => get(...args),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  },
}));

vi.mock("../src/auth/msal", () => ({
  loginWithMicrosoft: vi.fn(),
}));

import App from "../src/App";
import { ACCESS_TOKEN_KEY, clearTokens } from "../src/auth/tokens";

const adminMe = {
  id: "00000000-0000-0000-0000-000000000001",
  displayName: "Pat Admin",
  upn: "admin@contoso.com",
  roles: [{ id: "role-admin", name: "System Admin" }],
  permissions: ["manage_users", "manage_roles", "manage_permissions"],
  landing: { accessState: "authorized" as const, sections: [] },
};

const memberMe = {
  id: "00000000-0000-0000-0000-000000000002",
  displayName: "Alex Member",
  upn: "member@contoso.com",
  roles: [{ id: "role-member", name: "Member" }],
  permissions: [],
  landing: {
    accessState: "authorized" as const,
    sections: [],
  },
};

const pendingMe = {
  id: "00000000-0000-0000-0000-000000000003",
  displayName: "Sam Pending",
  upn: "pending@contoso.com",
  roles: [],
  permissions: [],
  landing: { accessState: "pending" as const, sections: [] },
};

describe("Settings navigation", () => {
  beforeEach(() => {
    clearTokens();
    get.mockReset();
    localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
  });

  it("shows Users, Roles, and Permissions routes when manage_* permissions are present", async () => {
    get.mockImplementation((path: string) => {
      if (path === "/me") {
        return Promise.resolve({ data: adminMe, error: undefined, response: { ok: true } });
      }
      if (path === "/people") {
        return Promise.resolve({ data: { people: [] }, error: undefined, response: { ok: true } });
      }
      if (path === "/roles") {
        return Promise.resolve({ data: { roles: [] }, error: undefined, response: { ok: true } });
      }
      if (path === "/permissions") {
        return Promise.resolve({ data: { modules: [] }, error: undefined, response: { ok: true } });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
    });

    render(<App />);
    expect(await screen.findByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByText(/^settings$/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^users$/i }));
    expect(await screen.findByRole("heading", { name: /users/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^roles$/i }));
    expect(await screen.findByRole("heading", { name: /roles/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^permissions$/i }));
    expect(await screen.findByRole("heading", { name: /permissions/i })).toBeInTheDocument();
  });

  it("hides Settings for a signed-in person without manage_* permissions", async () => {
    get.mockResolvedValue({ data: memberMe, error: undefined, response: { ok: true } });
    render(<App />);
    expect(await screen.findByText("Alex Member")).toBeInTheDocument();
    expect(screen.queryByText(/^settings$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^users$/i })).not.toBeInTheDocument();
  });

  it("does not offer Settings on pending access", async () => {
    get.mockResolvedValue({ data: pendingMe, error: undefined, response: { ok: true } });
    render(<App />);
    expect(await screen.findByText(/your access is pending/i)).toBeInTheDocument();
    expect(screen.queryByText(/^settings$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^users$/i })).not.toBeInTheDocument();
  });

  it("shows Clients, Resources, and Contracts only for matching manage_* permissions", async () => {
    const contractsOnly = {
      ...adminMe,
      permissions: ["manage_contracts"],
    };
    get.mockImplementation((path: string) => {
      if (path === "/me") {
        return Promise.resolve({ data: contractsOnly, error: undefined, response: { ok: true } });
      }
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [] },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/contracts") {
        return Promise.resolve({
          data: { contracts: [], page: 1, pageSize: 10, total: 0 },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
    });

    render(<App />);
    expect(await screen.findByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^contracts$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^clients$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^resources$/i })).not.toBeInTheDocument();
  });

  it("shows Clients nav when manage_clients is present without manage_contracts", async () => {
    const clientsOnly = {
      ...adminMe,
      permissions: ["manage_clients"],
    };
    get.mockImplementation((path: string) => {
      if (path === "/me") {
        return Promise.resolve({ data: clientsOnly, error: undefined, response: { ok: true } });
      }
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [] },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/clients") {
        return Promise.resolve({
          data: { clients: [], page: 1, pageSize: 10, total: 0 },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
    });

    render(<App />);
    expect(await screen.findByRole("button", { name: /^clients$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^contracts$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^resources$/i })).not.toBeInTheDocument();
  });

  it("shows Resources nav when manage_resources is present without manage_contracts", async () => {
    const resourcesOnly = {
      ...adminMe,
      permissions: ["manage_resources"],
    };
    get.mockImplementation((path: string) => {
      if (path === "/me") {
        return Promise.resolve({ data: resourcesOnly, error: undefined, response: { ok: true } });
      }
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [] },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/resources") {
        return Promise.resolve({
          data: { resources: [], page: 1, pageSize: 10, total: 0 },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
    });

    render(<App />);
    expect(await screen.findByRole("button", { name: /^resources$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^contracts$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^clients$/i })).not.toBeInTheDocument();
  });
});
