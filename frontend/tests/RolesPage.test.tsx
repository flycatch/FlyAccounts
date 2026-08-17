import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => get(...args),
    POST: (...args: unknown[]) => post(...args),
    PATCH: (...args: unknown[]) => patch(...args),
    DELETE: (...args: unknown[]) => del(...args),
  },
}));

import { RolesPage } from "../src/pages/settings/RolesPage";

const permissions = [
  { id: "perm-hr", permission: "manage_roles", name: "Manage roles" },
  { id: "perm-pmo", permission: "manage_permissions", name: "Manage permissions" },
];

describe("RolesPage", () => {
  const roles = [
    {
      id: "role-custom",
      name: "Custom",
      description: "Starter",
      permissions: [permissions[0]],
    },
  ];

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
    get.mockImplementation((path: string) => {
      if (path === "/permissions") {
        return Promise.resolve({
          data: { modules: [{ module: "settings", permissions }] },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({ data: { roles }, error: undefined, response: { ok: true } });
    });
  });

  async function openCreateModal() {
    fireEvent.click(screen.getByRole("button", { name: /^create role$/i }));
    expect(await screen.findByRole("dialog", { name: /create role/i })).toBeInTheDocument();
  }

  function selectRole(name: RegExp) {
    fireEvent.click(screen.getByRole("button", { name }));
  }

  it("shows roles as cards and opens detail only after selection", async () => {
    render(<RolesPage />);
    expect(await screen.findByText("Custom")).toBeInTheDocument();
    expect(screen.queryByLabelText(/attach permission/i)).not.toBeInTheDocument();
    selectRole(/custom/i);
    expect(screen.getByLabelText(/attach permission/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("keeps create-role name focused while typing in the modal", async () => {
    render(<RolesPage />);
    await screen.findByText("Custom");
    await openCreateModal();
    const nameField = screen.getByLabelText(/^role name$/i);
    nameField.focus();
    fireEvent.change(nameField, { target: { value: "Ops Lead" } });
    expect(nameField).toHaveFocus();
    expect(nameField).toHaveValue("Ops Lead");
  });

  it("creates a role, attaches two permissions, edits, and detaches one", async () => {
    const created = {
      id: "role-new",
      name: "Ops",
      description: "Operations",
      permissions: [] as typeof permissions,
    };
    post.mockImplementation((path: string) => {
      if (path === "/roles") {
        roles.push(created);
        return Promise.resolve({ data: created, error: undefined, response: { ok: true } });
      }
      created.permissions = [...created.permissions, permissions[created.permissions.length]];
      return Promise.resolve({ data: created, error: undefined, response: { ok: true } });
    });
    patch.mockResolvedValue({
      data: { ...created, name: "Operations", description: "Updated" },
      error: undefined,
      response: { ok: true },
    });
    del.mockResolvedValue({
      data: { ...created, permissions: [permissions[0]] },
      error: undefined,
      response: { ok: true },
    });

    render(<RolesPage />);
    expect(await screen.findByText("Custom")).toBeInTheDocument();
    await openCreateModal();
    fireEvent.change(screen.getByLabelText(/^role name$/i), { target: { value: "Ops" } });
    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: "Operations" } });
    const submit = screen
      .getAllByRole("button", { name: /^create role$/i })
      .find((btn) => btn.getAttribute("form") === "create-role-form");
    fireEvent.click(submit!);
    expect(await screen.findByText("Role created.")).toBeInTheDocument();

    selectRole(/^ops/i);
    fireEvent.change(screen.getByLabelText(/attach permission/i), { target: { value: "perm-hr" } });
    fireEvent.click(screen.getByRole("button", { name: /^attach permission$/i }));
    fireEvent.change(screen.getByLabelText(/attach permission/i), { target: { value: "perm-pmo" } });
    fireEvent.click(screen.getByRole("button", { name: /^attach permission$/i }));
    expect(post).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /edit ops/i }));
    fireEvent.change(screen.getByLabelText(/^role name$/i), { target: { value: "Operations" } });
    fireEvent.click(screen.getByRole("button", { name: /save role/i }));
    expect(await screen.findByText("Role updated.")).toBeInTheDocument();

    selectRole(/operations/i);
    fireEvent.click(screen.getByRole("button", { name: /detach manage permissions/i }));
    expect(await screen.findByText("Permission detached.")).toBeInTheDocument();
  });

  it("refuses delete while assigned and succeeds after revoke", async () => {
    del.mockResolvedValueOnce({
      data: undefined,
      error: { code: "role_still_assigned", message: "That role is still assigned to a person." },
      response: { ok: false, status: 409 },
    });
    render(<RolesPage />);
    await screen.findByText("Custom");
    selectRole(/custom/i);
    fireEvent.click(screen.getByRole("button", { name: /delete custom/i }));
    expect(await screen.findByText("That role is still assigned to a person.")).toBeInTheDocument();

    del.mockResolvedValueOnce({ data: undefined, error: undefined, response: { ok: true, status: 204 } });
    fireEvent.click(screen.getByRole("button", { name: /delete custom/i }));
    expect(await screen.findByText("Role deleted.")).toBeInTheDocument();
  });
});
