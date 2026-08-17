import { render, screen } from "@testing-library/react";
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

import { PermissionsPage } from "../src/pages/settings/PermissionsPage";

describe("PermissionsPage", () => {
  it("lists permissions grouped by module with name, permission, and description", async () => {
    get.mockResolvedValue({
      data: {
        modules: [
          {
            module: "settings",
            permissions: [
              {
                id: "1",
                name: "Manage users",
                permission: "manage_users",
                description: "Open Settings → Users and manage people, invites, and role assignments.",
              },
              {
                id: "2",
                name: "Manage roles",
                permission: "manage_roles",
                description: "Open Settings → Roles and create, edit, or delete roles and attach permissions.",
              },
            ],
          },
        ],
      },
      error: undefined,
      response: { ok: true },
    });

    render(<PermissionsPage />);
    expect(
      await screen.findByText(/read-only catalog grouped by module/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByText("Manage users")).toBeInTheDocument();
    expect(screen.getByText("manage_users")).toBeInTheDocument();
    expect(
      screen.getByText("Open Settings → Users and manage people, invites, and role assignments."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Whole-module grant")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
  });
});
