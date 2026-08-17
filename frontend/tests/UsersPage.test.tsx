import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
const patch = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => get(...args),
    POST: (...args: unknown[]) => post(...args),
    PATCH: (...args: unknown[]) => patch(...args),
    DELETE: (...args: unknown[]) => del(...args),
  },
}));

import { UsersPage } from "../src/pages/settings/UsersPage";

const people = [
  {
    id: "user-1",
    personType: "user" as const,
    email: "alex@contoso.com",
    displayName: "Alex Example",
    status: "active" as const,
    entryPath: "organization" as const,
    roles: [{ id: "role-hr", name: "Operator" }],
  },
  {
    id: "user-2",
    personType: "user" as const,
    email: "pending@contoso.com",
    displayName: "Sam Pending",
    status: "pending" as const,
    entryPath: "organization" as const,
    roles: [],
  },
  {
    id: "invite-1",
    personType: "invite" as const,
    email: "invited@contoso.com",
    status: "invited" as const,
    roles: [{ id: "role-hr", name: "Operator" }],
  },
];
const roles = [
  {
    id: "role-hr",
    name: "Operator",
    permissions: [{ id: "perm-hr", name: "Manage roles", permission: "manage_roles" }],
  },
  {
    id: "role-finance",
    name: "Member",
    permissions: [],
  },
];

async function openInviteModal() {
  fireEvent.click(screen.getByRole("button", { name: /^invite user$/i }));
  expect(await screen.findByRole("dialog", { name: /invite user/i })).toBeInTheDocument();
}

function selectPerson(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("UsersPage", () => {
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

  it("shows people as full-width cards and opens detail only after selection", async () => {
    render(<UsersPage />);
    expect(await screen.findByText("Alex Example")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for a role.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove person/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^assign roles$/i })).not.toBeInTheDocument();
    selectPerson(/sam pending/i);
    expect(screen.getByText("Waiting for a role.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("keeps invite email focused while typing in the modal", async () => {
    render(<UsersPage />);
    await screen.findByText("Alex Example");
    await openInviteModal();
    const email = screen.getByLabelText(/work email/i);
    email.focus();
    fireEvent.change(email, { target: { value: "typed@contoso.com" } });
    expect(email).toHaveFocus();
    expect(email).toHaveValue("typed@contoso.com");
  });

  it("shows an organization-entered person as pending and waiting for a role", async () => {
    render(<UsersPage />);
    expect(await screen.findByText("Sam Pending")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    selectPerson(/sam pending/i);
    expect(screen.getByText("Waiting for a role.")).toBeInTheDocument();
  });

  it("assigns roles from the selected person detail with multi-select", async () => {
    post.mockResolvedValue({
      data: {
        ...people[0],
        roles: [
          { id: "role-hr", name: "Operator" },
          { id: "role-finance", name: "Member" },
        ],
      },
      error: undefined,
      response: { ok: true },
    });

    render(<UsersPage />);
    expect(await screen.findByText("Alex Example")).toBeInTheDocument();
    selectPerson(/alex example/i);
    fireEvent.click(screen.getByLabelText(/^member$/i));
    fireEvent.click(screen.getByRole("button", { name: /^assign selected roles$/i }));
    expect(await screen.findByText("Role assigned.")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      "/people/{userId}/roles",
      expect.objectContaining({
        body: { roleIds: ["role-finance"] },
      }),
    );
  });

  it("invites with a role and with no roles and surfaces invite errors", async () => {
    const invited: typeof people = [];
    get.mockImplementation((path: string) => {
      if (path === "/people") {
        return Promise.resolve({ data: { people: [...people, ...invited] }, error: undefined, response: { ok: true } });
      }
      return Promise.resolve({ data: { roles }, error: undefined, response: { ok: true } });
    });
    post.mockImplementation((path: string, init?: { body?: { email?: string; roleIds?: string[] } }) => {
      if (path === "/people/invites") {
        const body = init?.body ?? {};
        const roleIds = body.roleIds ?? [];
        const person = {
          id: `invite-new-${invited.length + 1}`,
          personType: "invite" as const,
          email: body.email ?? "",
          status: "invited" as const,
          roles: roles.filter((role) => roleIds.includes(role.id)).map((role) => ({ id: role.id, name: role.name })),
        };
        invited.push(person);
        return Promise.resolve({ data: person, error: undefined, response: { ok: true } });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: false } });
    });

    render(<UsersPage />);
    await screen.findByText("Alex Example");
    await openInviteModal();
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "two@contoso.com" } });
    fireEvent.change(screen.getByLabelText(/invite role/i), { target: { value: "role-hr" } });
    fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    expect(await screen.findByText("Invite recorded.")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      "/people/invites",
      expect.objectContaining({
        body: { email: "two@contoso.com", roleIds: ["role-hr"] },
      }),
    );

    await openInviteModal();
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "none@contoso.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    expect((await screen.findAllByText("none@contoso.com")).length).toBeGreaterThan(0);

    post.mockResolvedValueOnce({
      data: undefined,
      error: { code: "duplicate_invite", message: "That email is already invited." },
      response: { ok: false, status: 409 },
    });
    await openInviteModal();
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "two@contoso.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    expect(await screen.findByText("That email is already invited.")).toBeInTheDocument();
  });

  it("assigns on invites from detail and shows last-admin", async () => {
    post.mockResolvedValue({
      data: {
        ...people[2],
        roles: [
          { id: "role-hr", name: "Operator" },
          { id: "role-finance", name: "Member" },
        ],
      },
      error: undefined,
      response: { ok: true },
    });
    render(<UsersPage />);
    await screen.findByText("Alex Example");
    selectPerson(/invited@contoso\.com/i);
    fireEvent.click(screen.getByLabelText(/^member$/i));
    fireEvent.click(screen.getByRole("button", { name: /^assign selected roles$/i }));
    expect(await screen.findByText("Role assigned.")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      "/people/invites/{inviteId}/roles",
      expect.objectContaining({ params: { path: { inviteId: "invite-1" } } }),
    );

    del.mockResolvedValueOnce({
      data: undefined,
      error: { code: "last_admin_required", message: "At least one person with manage users must remain." },
      response: { ok: false, status: 409 },
    });
    selectPerson(/alex example/i);
    fireEvent.click(screen.getByRole("button", { name: /revoke operator/i }));
    expect(await screen.findByText("At least one person with manage users must remain.")).toBeInTheDocument();
  });

  it("cancels invites and refuses last-admin remove", async () => {
    del.mockResolvedValueOnce({ data: undefined, error: undefined, response: { ok: true, status: 204 } });
    render(<UsersPage />);
    expect((await screen.findAllByText("invited@contoso.com")).length).toBeGreaterThan(0);
    selectPerson(/invited@contoso\.com/i);
    fireEvent.click(screen.getByRole("button", { name: /cancel invite/i }));
    expect(await screen.findByText("Invite cancelled.")).toBeInTheDocument();

    del.mockResolvedValueOnce({
      data: undefined,
      error: { code: "last_admin_required", message: "At least one person with manage users must remain." },
      response: { ok: false, status: 409 },
    });
    selectPerson(/alex example/i);
    fireEvent.click(screen.getByRole("button", { name: /remove person/i }));
    expect(await screen.findByText("At least one person with manage users must remain.")).toBeInTheDocument();
  });
});
