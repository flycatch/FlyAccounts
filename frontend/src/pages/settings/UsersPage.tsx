import { useCallback, useEffect, useMemo, useState } from "react";

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
import { PaginationBar } from "../../components/PaginationBar";
import { PillList } from "../../components/PillList";
import { SelectField } from "../../components/SelectField";
import { TextField } from "../../components/TextField";
import { emailFormat, useFormErrors } from "../../hooks/useFormErrors";
import { useListQueryParams } from "../../hooks/useListQueryParams";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
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

export function UsersPage() {
  const toast = useToast();
  const { search, searchInput, setSearchInput, page, pageSize, setPage, setPageSize } =
    useListQueryParams();
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const inviteValidators = useMemo(() => ({ inviteEmail: emailFormat("Work email") }), []);
  const { fieldError, onBlur, validateAll, clearErrors } = useFormErrors(inviteValidators);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const [peopleResult, rolesResult] = await Promise.all([
      apiClient.GET("/people", {
        params: { query: { search: search || undefined, page, pageSize } },
      }),
      apiClient.GET("/roles", { params: { query: { pageSize: 50, page: 1 } } }),
    ]);
    if (peopleResult.data) {
      setPeople(peopleResult.data.people);
      setTotal(peopleResult.data.total);
      setSelectedPersonId((current) =>
        current && !peopleResult.data.people.some((person) => person.id === current) ? null : current,
      );
    } else {
      setPeople([]);
      setTotal(0);
      setListError("Could not load people.");
    }
    if (rolesResult.data) {
      setRoles(rolesResult.data.roles);
    }
    setLoading(false);
  }, [page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openInvite() {
    clearErrors();
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
    if (selectedRoleIds.length === 0) {
      toast.error("Choose at least one role to assign.");
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
      toast.error(apiErrorMessage(result.error, "The role could not be assigned."));
      return;
    }
    toast.success("Role assigned.");
    setSelectedRoleIds([]);
    await load();
  }

  async function handleInvite() {
    if (!validateAll({ inviteEmail })) {
      return;
    }
    const roleIds = inviteRoleId ? [inviteRoleId] : [];
    const { data, error: apiError } = await apiClient.POST("/people/invites", {
      body: { email: inviteEmail.trim(), roleIds },
    });
    if (apiError || !data) {
      toast.error(apiErrorMessage(apiError, "The invite could not be created."));
      return;
    }
    toast.success("Invite recorded.");
    setInviteEmail("");
    setInviteRoleId("");
    setInviteOpen(false);
    await load();
  }

  async function handleRevoke(person: Person, roleId: string) {
    const result =
      person.personType === "invite"
        ? await apiClient.DELETE("/people/invites/{inviteId}/roles/{roleId}", {
            params: { path: { inviteId: person.id, roleId } },
          })
        : await apiClient.DELETE("/people/{userId}/roles/{roleId}", {
            params: { path: { userId: person.id, roleId } },
          });
    if (result.error || !result.data) {
      toast.error(apiErrorMessage(result.error, "The role could not be revoked."));
      return;
    }
    toast.success("Role revoked.");
    await load();
  }

  async function handleCancel(inviteId: string) {
    const { error: apiError, response } = await apiClient.DELETE("/people/invites/{inviteId}", {
      params: { path: { inviteId } },
    });
    if (apiError || (response && !response.ok)) {
      toast.error(apiErrorMessage(apiError, "The invite could not be cancelled."));
      return;
    }
    toast.success("Invite cancelled.");
    setSelectedPersonId(null);
    setSelectedRoleIds([]);
    await load();
  }

  async function handleRemove(userId: string) {
    const { error: apiError, response } = await apiClient.DELETE("/people/{userId}", {
      params: { path: { userId } },
    });
    if (apiError || (response && !response.ok)) {
      toast.error(apiErrorMessage(apiError, "The person could not be removed."));
      return;
    }
    toast.success("Person removed.");
    setSelectedPersonId(null);
    setSelectedRoleIds([]);
    await load();
  }

  const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;
  const assignedRoleIds = new Set(selectedPerson?.roles.map((role) => role.id) ?? []);
  const assignableRoles = roles.filter((role) => !assignedRoleIds.has(role.id));
  const emptyMessage =
    search.trim() !== "" ? "No people match this search." : "No people yet.";

  return (
    <section className="settings-page users-page">
      <p className="settings-subtitle">Invite people and assign roles to signed-in users.</p>
      <div className="settings-page-actions settings-toolbar">
        <input
          className="settings-search"
          type="search"
          placeholder="Search people"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search people"
        />
        <button type="button" className="settings-primary" onClick={openInvite}>
          Invite User
        </button>
      </div>
      {listError ? <p role="alert">{listError}</p> : null}
      {loading ? <p>Loading people…</p> : null}

      {!loading && !listError ? (
        <>
          {people.length === 0 ? <p>{emptyMessage}</p> : null}
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
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      ) : null}

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
            error={fieldError("inviteEmail")}
            onBlur={() => onBlur("inviteEmail", inviteEmail)}
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
        </form>
      </Modal>
    </section>
  );
}
