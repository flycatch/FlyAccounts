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
  roles: [{ id: "role-admin", name: "Entity Admin" }],
  permissions: ["access_administration"],
  landing: { accessState: "authorized" as const, sections: [] },
};

const financeMe = {
  id: "00000000-0000-0000-0000-000000000002",
  displayName: "Alex Finance",
  upn: "finance@contoso.com",
  roles: [{ id: "role-finance", name: "Finance User" }],
  permissions: ["finance_landing"],
  landing: {
    accessState: "authorized" as const,
    sections: [{ code: "finance_landing", title: "Finance", body: "Content allowed by finance_landing." }],
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

  it("shows Users, Roles, and Permissions only when access_administration is present", async () => {
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
        return Promise.resolve({ data: { permissions: [] }, error: undefined, response: { ok: true } });
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
    expect(screen.queryByText(/access administration/i)).not.toBeInTheDocument();
  });

  it("hides Settings for a signed-in person without access_administration", async () => {
    get.mockResolvedValue({ data: financeMe, error: undefined, response: { ok: true } });
    render(<App />);
    expect(await screen.findByText("Alex Finance")).toBeInTheDocument();
    expect(screen.queryByText(/^settings$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^users$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/access administration/i)).not.toBeInTheDocument();
  });

  it("does not offer Settings on pending access", async () => {
    get.mockResolvedValue({ data: pendingMe, error: undefined, response: { ok: true } });
    render(<App />);
    expect(await screen.findByText(/your access is pending/i)).toBeInTheDocument();
    expect(screen.queryByText(/^settings$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^users$/i })).not.toBeInTheDocument();
  });
});
