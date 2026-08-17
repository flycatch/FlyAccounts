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
    roles: [{ id: "role-hr", name: "HR User" }],
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
    roles: [{ id: "role-hr", name: "HR User" }],
  },
];
const roles = [
  {
    id: "role-hr",
    name: "HR User",
    permissions: [{ id: "perm-hr", code: "hr_landing", name: "HR landing", module: "hr" }],
  },
  {
    id: "role-finance",
    name: "Finance User",
    permissions: [
      { id: "perm-finance", code: "finance_landing", name: "Finance landing", module: "finance" },
    ],
  },
];

async function openInviteModal() {
  fireEvent.click(screen.getByRole("button", { name: /^invite user$/i }));
  expect(await screen.findByRole("dialog", { name: /invite user/i })).toBeInTheDocument();
}

async function openAssignModal() {
  fireEvent.click(screen.getByRole("button", { name: /^assign roles$/i }));
  expect(await screen.findByRole("dialog", { name: /assign roles/i })).toBeInTheDocument();
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

  it("shows an organization-entered person as pending and waiting for a role", async () => {
    render(<UsersPage />);
    expect(await screen.findByText("Sam Pending")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Waiting for a role.")).toBeInTheDocument();
  });

  it("lists signed-in people with status chips and assigns without replacing", async () => {
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

    render(<UsersPage />);
    expect(await screen.findByText("Alex Example")).toBeInTheDocument();
    expect(screen.getByText("alex@contoso.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    await openAssignModal();
    fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: "user-1" } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: "role-finance" } });
    fireEvent.click(screen.getByRole("button", { name: /^assign role$/i }));
    expect(await screen.findByText("Role assigned.")).toBeInTheDocument();
    expect(post).toHaveBeenCalled();
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
    expect((await screen.findAllByText("two@contoso.com")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Invited").length).toBeGreaterThan(0);

    await openInviteModal();
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "none@contoso.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    expect((await screen.findAllByText("none@contoso.com")).length).toBeGreaterThan(0);
    expect(post).toHaveBeenCalledWith(
      "/people/invites",
      expect.objectContaining({
        body: { email: "none@contoso.com", roleIds: [] },
      }),
    );

    post.mockResolvedValueOnce({
      data: undefined,
      error: { code: "duplicate_invite", message: "That email is already invited." },
      response: { ok: false, status: 409 },
    });
    await openInviteModal();
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "two@contoso.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    expect(await screen.findByText("That email is already invited.")).toBeInTheDocument();

    post.mockResolvedValueOnce({
      data: undefined,
      error: { code: "already_present", message: "That person is already listed." },
      response: { ok: false, status: 409 },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "alex@contoso.com" } });
    fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    expect(await screen.findByText("That person is already listed.")).toBeInTheDocument();
  });

  it("assigns and revokes on users and unused invites and shows last-admin", async () => {
    post.mockImplementation((path: string) => {
      if (path === "/people/invites/{inviteId}/roles") {
        return Promise.resolve({
          data: {
            ...people[2],
            roles: [
              { id: "role-hr", name: "HR User" },
              { id: "role-finance", name: "Finance User" },
            ],
          },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({
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
    });
    render(<UsersPage />);
    await screen.findByText("Alex Example");
    await openAssignModal();
    fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: "invite-1" } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: "role-finance" } });
    fireEvent.click(screen.getByRole("button", { name: /^assign role$/i }));
    expect(await screen.findByText("Role assigned.")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(
      "/people/invites/{inviteId}/roles",
      expect.objectContaining({ params: { path: { inviteId: "invite-1" } } }),
    );

    del.mockResolvedValueOnce({
      data: undefined,
      error: { code: "last_admin_required", message: "At least one person with access administration must remain." },
      response: { ok: false, status: 409 },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /revoke hr user/i })[0]);
    expect(
      await screen.findByText("At least one person with access administration must remain."),
    ).toBeInTheDocument();
  });

  it("cancels invites and refuses last-admin remove", async () => {
    del.mockResolvedValueOnce({ data: undefined, error: undefined, response: { ok: true, status: 204 } });
    render(<UsersPage />);
    expect((await screen.findAllByText("invited@contoso.com")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /cancel invite/i }));
    expect(await screen.findByText("Invite cancelled.")).toBeInTheDocument();

    del.mockResolvedValueOnce({
      data: undefined,
      error: { code: "last_admin_required", message: "At least one person with access administration must remain." },
      response: { ok: false, status: 409 },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /remove person/i })[0]);
    expect(
      await screen.findByText("At least one person with access administration must remain."),
    ).toBeInTheDocument();
  });

  it("surfaces duplicate assignment and last-admin messages", async () => {
    post.mockResolvedValue({
      data: undefined,
      error: { code: "duplicate_assignment", message: "That role is already assigned." },
      response: { ok: false, status: 409 },
    });
    render(<UsersPage />);
    await screen.findByText("Alex Example");
    await openAssignModal();
    fireEvent.change(screen.getByLabelText(/^person$/i), { target: { value: "user-1" } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: "role-hr" } });
    fireEvent.click(screen.getByRole("button", { name: /^assign role$/i }));
    expect(await screen.findByText("That role is already assigned.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    del.mockResolvedValue({
      data: undefined,
      error: { code: "last_admin_required", message: "At least one person with access administration must remain." },
      response: { ok: false, status: 409 },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /revoke hr user/i })[0]);
    expect(
      await screen.findByText("At least one person with access administration must remain."),
    ).toBeInTheDocument();
  });
});
