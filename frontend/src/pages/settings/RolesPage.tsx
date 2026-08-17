import { useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import "../settings/UsersPage.css";
import "./RolesPage.css";

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
      return "At least one person with access administration must remain.";
    }
  }
  return fallback;
}

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [attachId, setAttachId] = useState<Record<string, string>>({});

  async function load() {
    const [rolesResult, permissionsResult] = await Promise.all([
      apiClient.GET("/roles"),
      apiClient.GET("/permissions"),
    ]);
    if (rolesResult.data) {
      setRoles(rolesResult.data.roles);
    }
    if (permissionsResult.data) {
      setPermissions(permissionsResult.data.permissions);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
    setEditingId(null);
    await load();
  }

  async function handleAttach(roleId: string) {
    setError(null);
    setMessage(null);
    const permissionId = attachId[roleId];
    if (!permissionId) {
      setError("Choose a permission to attach.");
      return;
    }
    const { data, error: apiError } = await apiClient.POST("/roles/{roleId}/permissions", {
      params: { path: { roleId } },
      body: { permissionId },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The permission could not be attached."));
      return;
    }
    setMessage("Permission attached.");
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
    await load();
  }

  return (
    <section className="settings-page roles-page">
      <header>
        <h1>Roles</h1>
        <p className="settings-subtitle">Create and edit roles, then attach existing permissions.</p>
      </header>
      <form
        className="settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreate();
        }}
      >
        <label>
          Role name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <button type="submit" className="settings-primary">
          Create role
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {roles.map((role) => (
        <article key={role.id} className="settings-card">
          <div className="settings-card-header">
            {editingId === role.id ? (
              <div className="settings-form">
                <label>
                  Role name
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} />
                </label>
                <label>
                  Description
                  <input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                </label>
                <button type="button" className="settings-primary" onClick={() => void handleSave(role.id)}>
                  Save role
                </button>
              </div>
            ) : (
              <h2 className="settings-card-title">{role.name}</h2>
            )}
            {editingId === role.id ? null : (
              <button
                type="button"
                className="settings-secondary"
                onClick={() => {
                  setEditingId(role.id);
                  setEditName(role.name);
                  setEditDescription(role.description ?? "");
                }}
              >
                Edit {role.name}
              </button>
            )}
          </div>
          <div className="settings-card-body">
            {role.description ? <p>{role.description}</p> : null}
            <ul className="settings-permission-list">
              {role.permissions.map((permission) => (
                <li key={permission.id}>
                  <span>
                    {permission.name} ({permission.code})
                  </span>
                  <button
                    type="button"
                    className="settings-secondary"
                    onClick={() => void handleDetach(role.id, permission.id)}
                  >
                    Detach {permission.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="settings-form">
              <label>
                Attach permission
                <select
                  value={attachId[role.id] ?? ""}
                  onChange={(event) => setAttachId((current) => ({ ...current, [role.id]: event.target.value }))}
                >
                  <option value="">Select a permission</option>
                  {permissions.map((permission) => (
                    <option key={permission.id} value={permission.id}>
                      {permission.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="settings-primary" onClick={() => void handleAttach(role.id)}>
                Attach permission
              </button>
              <button type="button" className="settings-secondary" onClick={() => void handleDelete(role.id)}>
                Delete {role.name}
              </button>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
