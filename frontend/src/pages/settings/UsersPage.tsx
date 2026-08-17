import { useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { Modal } from "../../components/Modal";
import { SelectField } from "../../components/SelectField";
import { TextField } from "../../components/TextField";
import "./UsersPage.css";

type Person = components["schemas"]["Person"];
type Role = components["schemas"]["Role"];

type ActiveModal = "invite" | "assign" | null;

function statusLabel(status: Person["status"]): string {
  if (status === "active") {
    return "Active";
  }
  if (status === "invited") {
    return "Invited";
  }
  return "Pending";
}

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "code" in payload) {
    const code = (payload as { code: string }).code;
    if (code === "duplicate_assignment") {
      return "That role is already assigned.";
    }
    if (code === "duplicate_invite") {
      return "That email is already invited.";
    }
    if (code === "already_present") {
      return "That person is already listed.";
    }
    if (code === "last_admin_required") {
      return "At least one person with access administration must remain.";
    }
    if (code === "role_still_assigned") {
      return "That role is still assigned to a person.";
    }
  }
  return fallback;
}

export function UsersPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [peopleResult, rolesResult] = await Promise.all([
      apiClient.GET("/people"),
      apiClient.GET("/roles"),
    ]);
    if (peopleResult.data) {
      setPeople(peopleResult.data.people);
    }
    if (rolesResult.data) {
      setRoles(rolesResult.data.roles);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function closeModal() {
    setActiveModal(null);
  }

  function openInvite() {
    setError(null);
    setMessage(null);
    setInviteEmail("");
    setInviteRoleId("");
    setActiveModal("invite");
  }

  function openAssign() {
    setError(null);
    setMessage(null);
    setSelectedUserId("");
    setSelectedRoleId("");
    setActiveModal("assign");
  }

  async function handleAssign() {
    setError(null);
    setMessage(null);
    if (!selectedUserId || !selectedRoleId) {
      setError("Choose a person and a role to assign.");
      return;
    }
    const person = people.find((item) => item.id === selectedUserId);
    const result =
      person?.personType === "invite"
        ? await apiClient.POST("/people/invites/{inviteId}/roles", {
            params: { path: { inviteId: selectedUserId } },
            body: { roleId: selectedRoleId },
          })
        : await apiClient.POST("/people/{userId}/roles", {
            params: { path: { userId: selectedUserId } },
            body: { roleId: selectedRoleId },
          });
    if (result.error || !result.data) {
      setError(errorMessage(result.error, "The role could not be assigned."));
      return;
    }
    setMessage("Role assigned.");
    setSelectedUserId("");
    setSelectedRoleId("");
    setActiveModal(null);
    await load();
  }

  async function handleInvite() {
    setError(null);
    setMessage(null);
    if (!inviteEmail.trim()) {
      setError("Enter a work email to invite.");
      return;
    }
    const roleIds = inviteRoleId ? [inviteRoleId] : [];
    const { data, error: apiError } = await apiClient.POST("/people/invites", {
      body: { email: inviteEmail.trim(), roleIds },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The invite could not be created."));
      return;
    }
    setMessage("Invite recorded.");
    setInviteEmail("");
    setInviteRoleId("");
    setActiveModal(null);
    await load();
  }

  async function handleRevoke(person: Person, roleId: string) {
    setError(null);
    setMessage(null);
    const result =
      person.personType === "invite"
        ? await apiClient.DELETE("/people/invites/{inviteId}/roles/{roleId}", {
            params: { path: { inviteId: person.id, roleId } },
          })
        : await apiClient.DELETE("/people/{userId}/roles/{roleId}", {
            params: { path: { userId: person.id, roleId } },
          });
    if (result.error || !result.data) {
      setError(errorMessage(result.error, "The role could not be revoked."));
      return;
    }
    setMessage("Role revoked.");
    await load();
  }

  async function handleCancel(inviteId: string) {
    setError(null);
    setMessage(null);
    const { error: apiError, response } = await apiClient.DELETE("/people/invites/{inviteId}", {
      params: { path: { inviteId } },
    });
    if (apiError || (response && !response.ok)) {
      setError(errorMessage(apiError, "The invite could not be cancelled."));
      return;
    }
    setMessage("Invite cancelled.");
    await load();
  }

  async function handleRemove(userId: string) {
    setError(null);
    setMessage(null);
    const { error: apiError, response } = await apiClient.DELETE("/people/{userId}", {
      params: { path: { userId } },
    });
    if (apiError || (response && !response.ok)) {
      setError(errorMessage(apiError, "The person could not be removed."));
      return;
    }
    setMessage("Person removed.");
    await load();
  }

  return (
    <section className="settings-page users-page">
      <p className="settings-subtitle">Invite people and assign roles to signed-in users.</p>
      <div className="settings-page-actions">
        <button type="button" className="settings-primary" onClick={openInvite}>
          Invite User
        </button>
        <button type="button" className="settings-primary" onClick={openAssign}>
          Assign Roles
        </button>
      </div>
      {error && !activeModal ? <p role="alert">{error}</p> : null}
      {message && !activeModal ? <p>{message}</p> : null}
      <div className="settings-card">
        <div className="settings-card-header">
          <h2 className="settings-card-title">People</h2>
        </div>
        <div className="settings-card-body">
          {people.map((person) => (
            <article key={person.id} className="settings-row">
              <div>
                <h3 className="settings-card-title">{person.displayName ?? person.email}</h3>
                <p>{person.email}</p>
                <span className={`status-chip is-${person.status}`}>{statusLabel(person.status)}</span>
                {person.personType === "user" && person.roles.length === 0 ? <p>Waiting for a role.</p> : null}
              </div>
              <ul className="settings-role-list">
                {person.roles.map((role) => (
                  <li key={role.id}>
                    <span>{role.name}</span>
                    <button
                      type="button"
                      className="settings-secondary"
                      onClick={() => void handleRevoke(person, role.id)}
                    >
                      Revoke {role.name}
                    </button>
                  </li>
                ))}
              </ul>
              {person.personType === "invite" ? (
                <button type="button" className="settings-secondary" onClick={() => void handleCancel(person.id)}>
                  Cancel invite
                </button>
              ) : (
                <button type="button" className="settings-secondary" onClick={() => void handleRemove(person.id)}>
                  Remove person
                </button>
              )}
            </article>
          ))}
        </div>
      </div>

      <Modal
        open={activeModal === "invite"}
        title="Invite User"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="settings-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="invite-user-form" className="settings-primary">
              Invite
            </button>
          </>
        }
      >
        <form
          id="invite-user-form"
          className="settings-form settings-form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void handleInvite();
          }}
        >
          <TextField
            label="Work email"
            type="email"
            name="invite-email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            autoComplete="off"
          />
          <SelectField
            label="Invite Role"
            name="invite-role"
            value={inviteRoleId}
            onChange={(event) => setInviteRoleId(event.target.value)}
          >
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </SelectField>
          {error && activeModal === "invite" ? <p role="alert">{error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={activeModal === "assign"}
        title="Assign Roles"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="settings-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" form="assign-roles-form" className="settings-primary">
              Assign role
            </button>
          </>
        }
      >
        <form
          id="assign-roles-form"
          className="settings-form settings-form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void handleAssign();
          }}
        >
          <SelectField
            label="Person"
            name="assign-person"
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          >
            <option value="">Select a person</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName ?? person.email} ({person.email})
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Role"
            name="assign-role"
            value={selectedRoleId}
            onChange={(event) => setSelectedRoleId(event.target.value)}
          >
            <option value="">Select a role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </SelectField>
          {error && activeModal === "assign" ? <p role="alert">{error}</p> : null}
        </form>
      </Modal>
    </section>
  );
}
