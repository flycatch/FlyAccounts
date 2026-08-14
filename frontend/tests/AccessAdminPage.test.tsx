import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => get(...args),
    POST: (...args: unknown[]) => post(...args),
    DELETE: (...args: unknown[]) => del(...args),
  },
}));

import { AccessAdminPage } from "../src/pages/AccessAdminPage";

const people = [
  {
    id: "user-1",
    displayName: "Alex Example",
    upn: "alex@contoso.com",
    roles: [{ id: "role-hr", name: "HR User" }],
  },
];
const roles = [
  { id: "role-hr", name: "HR User" },
  { id: "role-finance", name: "Finance User" },
];

describe("AccessAdminPage", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
    get.mockImplementation((path: string) => {
      if (path === "/people") {
        return Promise.resolve({ data: { people }, error: undefined, response: { ok: true } });
      }
      return Promise.resolve({ data: { roles }, error: undefined, response: { ok: true } });
    });
  });

  it("lists people and roles and assigns without replacing", async () => {
    post.mockResolvedValue({
      data: {
        ...people[0],
        roles: [
          { id: "role-hr", name: "HR User" },
          { id: "role-finance", name: "Finance User" },
        ],
      },
      error: undefined,
      response: { ok: true },
    });

    render(<AccessAdminPage onBack={() => undefined} />);
    expect(await screen.findByText("Alex Example")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "user-1" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "role-finance" } });
    fireEvent.click(screen.getByRole("button", { name: /assign role/i }));
    expect(await screen.findByText("Role assigned.")).toBeInTheDocument();
    expect(post).toHaveBeenCalled();
  });

  it("surfaces duplicate assignment and last-admin messages", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { code: "duplicate_assignment", message: "That role is already assigned." },
      response: { ok: false, status: 409 },
    });
    render(<AccessAdminPage onBack={() => undefined} />);
    await screen.findByText("Alex Example");
    fireEvent.change(screen.getByLabelText("Person"), { target: { value: "user-1" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "role-hr" } });
    fireEvent.click(screen.getByRole("button", { name: /assign role/i }));
    expect(await screen.findByText("That role is already assigned.")).toBeInTheDocument();

    del.mockResolvedValue({
      data: undefined,
      error: { code: "last_admin_required", message: "At least one person with access administration must remain." },
      response: { ok: false, status: 409 },
    });
    fireEvent.click(screen.getByRole("button", { name: /revoke hr user/i }));
    expect(
      await screen.findByText("At least one person with access administration must remain."),
    ).toBeInTheDocument();
  });
});
