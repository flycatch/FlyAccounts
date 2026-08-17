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
  { id: "perm-hr", code: "hr_landing", name: "HR landing", module: "hr" },
  { id: "perm-pmo", code: "pmo_landing", name: "PMO landing", module: "pmo" },
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
        return Promise.resolve({ data: { permissions }, error: undefined, response: { ok: true } });
      }
      return Promise.resolve({ data: { roles }, error: undefined, response: { ok: true } });
    });
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
    fireEvent.change(screen.getByLabelText(/^role name$/i), { target: { value: "Ops" } });
    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: "Operations" } });
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    expect(await screen.findByText("Role created.")).toBeInTheDocument();

    const attachSelects = screen.getAllByLabelText(/attach permission/i);
    fireEvent.change(attachSelects[attachSelects.length - 1], { target: { value: "perm-hr" } });
    fireEvent.click(screen.getAllByRole("button", { name: /attach permission/i }).at(-1)!);
    fireEvent.change(screen.getAllByLabelText(/attach permission/i).at(-1)!, { target: { value: "perm-pmo" } });
    fireEvent.click(screen.getAllByRole("button", { name: /attach permission/i }).at(-1)!);
    expect(post).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /edit ops/i }));
    fireEvent.change(screen.getAllByLabelText(/^role name$/i)[1], { target: { value: "Operations" } });
    fireEvent.click(screen.getByRole("button", { name: /save role/i }));
    expect(await screen.findByText("Role updated.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /detach pmo landing/i })[0]);
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
    fireEvent.click(screen.getByRole("button", { name: /delete custom/i }));
    expect(await screen.findByText("That role is still assigned to a person.")).toBeInTheDocument();

    del.mockResolvedValueOnce({ data: undefined, error: undefined, response: { ok: true, status: 204 } });
    fireEvent.click(screen.getByRole("button", { name: /delete custom/i }));
    expect(await screen.findByText("Role deleted.")).toBeInTheDocument();
  });
});
