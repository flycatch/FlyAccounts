import { useEffect, useState } from "react";

import cancelIcon from "../../assets/icons/cancel.svg";
import deleteIcon from "../../assets/icons/delete.svg";
import revokeIcon from "../../assets/icons/revoke.svg";
import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { DetailPanel } from "../../components/DetailPanel";
import { EntityCard } from "../../components/EntityCard";
import { IconButton } from "../../components/IconButton";
import { MasterDetailLayout } from "../../components/MasterDetailLayout";
import { Modal } from "../../components/Modal";
import { PillList } from "../../components/PillList";
import { SelectField } from "../../components/SelectField";
import { TextField } from "../../components/TextField";
import "../../components/settings.css";

type Person = components["schemas"]["Person"];
type Role = components["schemas"]["Role"];

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
      return "At least one person with manage users must remain.";
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
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [peopleResult, rolesResult] = await Promise.all([
      apiClient.GET("/people"),
      apiClient.GET("/roles"),
    ]);
    if (peopleResult.data) {
      setPeople(peopleResult.data.people);
      if (selectedPersonId && !peopleResult.data.people.some((person) => person.id === selectedPersonId)) {
        setSelectedPersonId(null);
        setSelectedRoleIds([]);
      }
    }
    if (rolesResult.data) {
      setRoles(rolesResult.data.roles);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on mount only
  }, []);

  function openInvite() {
    setError(null);
    setMessage(null);
    setInviteEmail("");
    setInviteRoleId("");
    setInviteOpen(true);
  }

  function toggleRoleId(roleId: string) {
    setSelectedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  }

  async function handleAssign(person: Person) {
    setError(null);
    setMessage(null);
    if (selectedRoleIds.length === 0) {
      setError("Choose at least one role to assign.");
      return;
    }
    const result =
      person.personType === "invite"
        ? await apiClient.POST("/people/invites/{inviteId}/roles", {
            params: { path: { inviteId: person.id } },
            body: { roleIds: selectedRoleIds },
          })
        : await apiClient.POST("/people/{userId}/roles", {
            params: { path: { userId: person.id } },
            body: { roleIds: selectedRoleIds },
          });
    if (result.error || !result.data) {
      setError(errorMessage(result.error, "The role could not be assigned."));
      return;
    }
    setMessage("Role assigned.");
    setSelectedRoleIds([]);
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
    setInviteOpen(false);
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
    setSelectedPersonId(null);
    setSelectedRoleIds([]);
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
    setSelectedPersonId(null);
    setSelectedRoleIds([]);
    await load();
  }

  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;
  const assignedRoleIds = new Set(selectedPerson?.roles.map((role) => role.id) ?? []);
  const assignableRoles = roles.filter((role) => !assignedRoleIds.has(role.id));

  return (
    <section className="settings-page users-page">
      <p className="settings-subtitle">Invite people and assign roles to signed-in users.</p>
      <div className="settings-page-actions">
        <button type="button" className="settings-primary" onClick={openInvite}>
          Invite User
        </button>
      </div>
      {error && !inviteOpen ? <p role="alert">{error}</p> : null}
      {message && !inviteOpen ? <p>{message}</p> : null}

      <MasterDetailLayout
        selected={Boolean(selectedPerson)}
        onBack={() => {
          setSelectedPersonId(null);
          setSelectedRoleIds([]);
        }}
        list={people.map((person) => (
          <EntityCard
            key={person.id}
            title={person.displayName ?? person.email}
            subtitle={person.email}
            selected={person.id === selectedPersonId}
            onSelect={() => {
              setSelectedPersonId(person.id);
              setSelectedRoleIds([]);
              setError(null);
            }}
            meta={
              <>
                <span className={`status-chip is-${person.status}`}>{statusLabel(person.status)}</span>
                <PillList items={person.roles.map((role) => role.name)} />
              </>
            }
          />
        ))}
        detail={
          selectedPerson ? (
            <DetailPanel
              title={selectedPerson.displayName ?? selectedPerson.email}
              subtitle={selectedPerson.email}
              actions={
                selectedPerson.personType === "invite" ? (
                  <IconButton
                    label="Cancel invite"
                    icon={<img src={cancelIcon} alt="" />}
                    danger
                    onClick={() => void handleCancel(selectedPerson.id)}
                  />
                ) : (
                  <IconButton
                    label="Remove person"
                    icon={<img src={deleteIcon} alt="" />}
                    danger
                    onClick={() => void handleRemove(selectedPerson.id)}
                  />
                )
              }
            >
              <span className={`status-chip is-${selectedPerson.status}`}>
                {statusLabel(selectedPerson.status)}
              </span>
              {selectedPerson.personType === "user" && selectedPerson.roles.length === 0 ? (
                <p>Waiting for a role.</p>
              ) : null}
              <ul className="settings-detail-list">
                {selectedPerson.roles.map((role) => (
                  <li key={role.id}>
                    <span className="settings-detail-list-label">{role.name}</span>
                    <IconButton
                      label={`Revoke ${role.name}`}
                      icon={<img src={revokeIcon} alt="" />}
                      onClick={() => void handleRevoke(selectedPerson, role.id)}
                    />
                  </li>
                ))}
              </ul>
              <div className="settings-form settings-form-stack">
                <p className="settings-assign-label">Assign roles</p>
                {assignableRoles.length === 0 ? (
                  <p className="settings-assign-empty">All roles are already assigned.</p>
                ) : (
                  <ul className="settings-role-multiselect">
                    {assignableRoles.map((role) => (
                      <li key={role.id}>
                        <label className="settings-role-option">
                          <input
                            type="checkbox"
                            checked={selectedRoleIds.includes(role.id)}
                            onChange={() => toggleRoleId(role.id)}
                          />
                          <span>{role.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="settings-page-actions">
                  <button
                    type="button"
                    className="settings-primary"
                    disabled={selectedRoleIds.length === 0}
                    onClick={() => void handleAssign(selectedPerson)}
                  >
                    Assign selected roles
                  </button>
                </div>
              </div>
            </DetailPanel>
          ) : null
        }
      />

      <Modal
        open={inviteOpen}
        title="Invite User"
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <button type="button" className="settings-secondary" onClick={() => setInviteOpen(false)}>
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
          {error && inviteOpen ? <p role="alert">{error}</p> : null}
        </form>
      </Modal>
    </section>
  );
}
