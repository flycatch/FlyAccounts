import { useEffect, useState } from "react";

import deleteIcon from "../../assets/icons/delete.svg";
import editIcon from "../../assets/icons/edit.svg";
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

type Role = components["schemas"]["Role"];
type Permission = components["schemas"]["Permission"];

function errorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "code" in payload) {
    const code = (payload as { code: string }).code;
    if (code === "duplicate_role_name") {
      return "A role with that name already exists.";
    }
    if (code === "duplicate_permission") {
      return "That permission is already attached to the role.";
    }
    if (code === "role_still_assigned") {
      return "That role is still assigned to a person.";
    }
    if (code === "last_admin_required") {
      return "At least one person with manage users must remain.";
    }
  }
  return fallback;
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [attachPermissionId, setAttachPermissionId] = useState("");

  async function load() {
    const [rolesResult, permissionsResult] = await Promise.all([
      apiClient.GET("/roles"),
      apiClient.GET("/permissions"),
    ]);
    if (rolesResult.data) {
      setRoles(rolesResult.data.roles);
      if (selectedRoleId && !rolesResult.data.roles.some((role) => role.id === selectedRoleId)) {
        setSelectedRoleId(null);
        setEditing(false);
      }
    }
    if (permissionsResult.data) {
      setPermissions(permissionsResult.data.modules.flatMap((group) => group.permissions));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on mount only
  }, []);

  function openCreate() {
    setError(null);
    setMessage(null);
    setName("");
    setDescription("");
    setCreateOpen(true);
  }

  async function handleCreate() {
    setError(null);
    setMessage(null);
    if (!name.trim()) {
      setError("A role name is required.");
      return;
    }
    const { data, error: apiError } = await apiClient.POST("/roles", {
      body: { name: name.trim(), description: description.trim() || undefined },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The role could not be created."));
      return;
    }
    setMessage("Role created.");
    setName("");
    setDescription("");
    setCreateOpen(false);
    setSelectedRoleId(data.id);
    await load();
  }

  async function handleSave(roleId: string) {
    setError(null);
    setMessage(null);
    const { data, error: apiError } = await apiClient.PATCH("/roles/{roleId}", {
      params: { path: { roleId } },
      body: { name: editName.trim(), description: editDescription },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The role could not be updated."));
      return;
    }
    setMessage("Role updated.");
    setEditing(false);
    await load();
  }

  async function handleAttach(roleId: string) {
    setError(null);
    setMessage(null);
    if (!attachPermissionId) {
      setError("Choose a permission to attach.");
      return;
    }
    const { data, error: apiError } = await apiClient.POST("/roles/{roleId}/permissions", {
      params: { path: { roleId } },
      body: { permissionId: attachPermissionId },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The permission could not be attached."));
      return;
    }
    setMessage("Permission attached.");
    setAttachPermissionId("");
    await load();
  }

  async function handleDetach(roleId: string, permissionId: string) {
    setError(null);
    setMessage(null);
    const { data, error: apiError } = await apiClient.DELETE("/roles/{roleId}/permissions/{permissionId}", {
      params: { path: { roleId, permissionId } },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The permission could not be detached."));
      return;
    }
    setMessage("Permission detached.");
    await load();
  }

  async function handleDelete(roleId: string) {
    setError(null);
    setMessage(null);
    const { error: apiError, response } = await apiClient.DELETE("/roles/{roleId}", {
      params: { path: { roleId } },
    });
    if (apiError || (response && !response.ok)) {
      setError(errorMessage(apiError, "The role could not be deleted."));
      return;
    }
    setMessage("Role deleted.");
    setSelectedRoleId(null);
    setEditing(false);
    await load();
  }

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  return (
    <section className="settings-page roles-page">
      <p className="settings-subtitle">Create and edit roles, then attach existing permissions.</p>
      <div className="settings-page-actions">
        <button type="button" className="settings-primary" onClick={openCreate}>
          Create Role
        </button>
      </div>
      {error && !createOpen ? <p role="alert">{error}</p> : null}
      {message && !createOpen ? <p>{message}</p> : null}

      <MasterDetailLayout
        selected={Boolean(selectedRole)}
        onBack={() => {
          setSelectedRoleId(null);
          setEditing(false);
        }}
        list={roles.map((role) => (
          <EntityCard
            key={role.id}
            title={role.name}
            subtitle={role.description ? truncate(role.description) : undefined}
            selected={role.id === selectedRoleId}
            onSelect={() => {
              setSelectedRoleId(role.id);
              setEditing(false);
              setAttachPermissionId("");
            }}
            meta={<PillList items={role.permissions.map((permission) => permission.name)} />}
          />
        ))}
        detail={
          selectedRole ? (
            <DetailPanel
              title={selectedRole.name}
              subtitle={editing ? undefined : selectedRole.description}
              actions={
                editing ? null : (
                  <>
                    <IconButton
                      label={`Edit ${selectedRole.name}`}
                      icon={<img src={editIcon} alt="" />}
                      onClick={() => {
                        setEditing(true);
                        setEditName(selectedRole.name);
                        setEditDescription(selectedRole.description ?? "");
                      }}
                    />
                    <IconButton
                      label={`Delete ${selectedRole.name}`}
                      icon={<img src={deleteIcon} alt="" />}
                      danger
                      onClick={() => void handleDelete(selectedRole.id)}
                    />
                  </>
                )
              }
            >
              {editing ? (
                <form
                  className="settings-form settings-form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSave(selectedRole.id);
                  }}
                >
                  <TextField
                    label="Role name"
                    name="edit-role-name"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                  <TextField
                    label="Description"
                    name="edit-role-description"
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                  />
                  <div className="settings-page-actions">
                    <button type="button" className="settings-secondary" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="settings-primary">
                      Save role
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <ul className="settings-detail-list">
                    {selectedRole.permissions.map((permission) => (
                      <li key={permission.id}>
                        <span className="settings-detail-list-label">
                          {permission.name} ({permission.permission})
                        </span>
                        <IconButton
                          label={`Detach ${permission.name}`}
                          icon={<img src={revokeIcon} alt="" />}
                          onClick={() => void handleDetach(selectedRole.id, permission.id)}
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="settings-form settings-form-stack">
                    <SelectField
                      label="Attach permission"
                      name="attach-permission"
                      value={attachPermissionId}
                      onChange={(event) => setAttachPermissionId(event.target.value)}
                    >
                      <option value="">Select a permission</option>
                      {permissions.map((permission) => (
                        <option key={permission.id} value={permission.id}>
                          {permission.name}
                        </option>
                      ))}
                    </SelectField>
                    <button
                      type="button"
                      className="settings-primary"
                      onClick={() => void handleAttach(selectedRole.id)}
                    >
                      Attach permission
                    </button>
                  </div>
                </>
              )}
            </DetailPanel>
          ) : null
        }
      />

      <Modal
        open={createOpen}
        title="Create Role"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" className="settings-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="create-role-form" className="settings-primary">
              Create role
            </button>
          </>
        }
      >
        <form
          id="create-role-form"
          className="settings-form settings-form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <TextField
            label="Role name"
            name="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Description"
            name="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {error && createOpen ? <p role="alert">{error}</p> : null}
        </form>
      </Modal>
    </section>
  );
}
