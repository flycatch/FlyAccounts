import { useCallback, useEffect, useMemo, useState } from "react";

import deleteIcon from "../../assets/icons/delete.svg";
import editIcon from "../../assets/icons/edit.svg";
import cancelIcon from "../../assets/icons/cancel.svg";
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
import { required, useFormErrors } from "../../hooks/useFormErrors";
import { useListQueryParams } from "../../hooks/useListQueryParams";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
import "../../components/settings.css";

type Role = components["schemas"]["Role"];
type Permission = components["schemas"]["Permission"];

function truncate(text: string, max = 80): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export function RolesPage() {
  const toast = useToast();
  const { search, searchInput, setSearchInput, page, pageSize, setPage, setPageSize } =
    useListQueryParams();
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [attachPermissionId, setAttachPermissionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const createValidators = useMemo(() => ({ name: required("Role name") }), []);
  const editValidators = useMemo(() => ({ editName: required("Role name") }), []);
  const createForm = useFormErrors(createValidators);
  const editForm = useFormErrors(editValidators);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const [rolesResult, permissionsResult] = await Promise.all([
      apiClient.GET("/roles", {
        params: { query: { search: search || undefined, page, pageSize } },
      }),
      apiClient.GET("/permissions"),
    ]);
    if (rolesResult.data) {
      setRoles(rolesResult.data.roles);
      setTotal(rolesResult.data.total);
      setSelectedRoleId((current) =>
        current && !rolesResult.data.roles.some((role) => role.id === current) ? null : current,
      );
    } else {
      setRoles([]);
      setTotal(0);
      setListError("Could not load roles.");
    }
    if (permissionsResult.data) {
      setPermissions(permissionsResult.data.modules.flatMap((group) => group.permissions));
    }
    setLoading(false);
  }, [page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    createForm.clearErrors();
    setName("");
    setDescription("");
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!createForm.validateAll({ name })) {
      return;
    }
    const { data, error: apiError } = await apiClient.POST("/roles", {
      body: { name: name.trim(), description: description.trim() || undefined },
    });
    if (apiError || !data) {
      toast.error(apiErrorMessage(apiError, "The role could not be created."));
      return;
    }
    toast.success("Role created.");
    setName("");
    setDescription("");
    setCreateOpen(false);
    setSelectedRoleId(data.id);
    await load();
  }

  async function handleSave(roleId: string) {
    if (!editForm.validateAll({ editName })) {
      return;
    }
    const { data, error: apiError } = await apiClient.PATCH("/roles/{roleId}", {
      params: { path: { roleId } },
      body: { name: editName.trim(), description: editDescription },
    });
    if (apiError || !data) {
      toast.error(apiErrorMessage(apiError, "The role could not be updated."));
      return;
    }
    toast.success("Role updated.");
    setEditing(false);
    await load();
  }

  async function handleAttach(roleId: string) {
    if (!attachPermissionId) {
      toast.error("Choose a permission to attach.");
      return;
    }
    const { data, error: apiError } = await apiClient.POST("/roles/{roleId}/permissions", {
      params: { path: { roleId } },
      body: { permissionId: attachPermissionId },
    });
    if (apiError || !data) {
      toast.error(apiErrorMessage(apiError, "The permission could not be attached."));
      return;
    }
    toast.success("Permission attached.");
    setAttachPermissionId("");
    await load();
  }

  async function handleDetach(roleId: string, permissionId: string) {
    const { data, error: apiError } = await apiClient.DELETE(
      "/roles/{roleId}/permissions/{permissionId}",
      {
        params: { path: { roleId, permissionId } },
      },
    );
    if (apiError || !data) {
      toast.error(apiErrorMessage(apiError, "The permission could not be detached."));
      return;
    }
    toast.success("Permission detached.");
    await load();
  }

  async function handleDelete(roleId: string) {
    const { error: apiError, response } = await apiClient.DELETE("/roles/{roleId}", {
      params: { path: { roleId } },
    });
    if (apiError || (response && !response.ok)) {
      toast.error(apiErrorMessage(apiError, "The role could not be deleted."));
      return;
    }
    toast.success("Role deleted.");
    setSelectedRoleId(null);
    setEditing(false);
    await load();
  }

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const emptyMessage = search.trim() !== "" ? "No roles match this search." : "No roles yet.";

  return (
    <section className="settings-page roles-page">
      <p className="settings-subtitle">Create and edit roles, then attach existing permissions.</p>
      <div className="settings-page-actions settings-toolbar">
        <input
          className="settings-search"
          type="search"
          placeholder="Search roles"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Search roles"
        />
        <button type="button" className="settings-primary" onClick={openCreate}>
          Create Role
        </button>
      </div>
      {listError ? <p role="alert">{listError}</p> : null}
      {loading ? <p>Loading roles…</p> : null}

      {!loading && !listError ? (
        <>
          {roles.length === 0 ? <p>{emptyMessage}</p> : null}
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
                  onClose={() => {
                    setSelectedRoleId(null);
                    setEditing(false);
                  }}
                  actions={
                    editing ? null : (
                      <>
                        <IconButton
                          label={`Edit ${selectedRole.name}`}
                          icon={<img src={editIcon} alt="" />}
                          onClick={() => {
                            editForm.clearErrors();
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
                    <>
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
                          error={editForm.fieldError("editName")}
                          onBlur={() => editForm.onBlur("editName", editName)}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                        <TextField
                          label="Description"
                          name="edit-role-description"
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                        />
                        <div className="settings-page-actions">
                          <button
                            type="button"
                            className="settings-secondary"
                            onClick={() => setEditing(false)}
                          >
                            Cancel
                          </button>
                          <button type="submit" className="settings-primary">
                            Save role
                          </button>
                        </div>
                      </form>
                      <div
                        style={{
                          marginTop: "var(--space-5)",
                          borderTop: "1px solid var(--color-stroke)",
                          paddingTop: "var(--space-4)",
                        }}
                      >
                        <p className="settings-subtitle">Permissions</p>
                        <ul className="settings-detail-list">
                          {selectedRole.permissions.map((permission) => (
                            <li key={permission.id}>
                              <span className="settings-detail-list-label">
                                {permission.name} ({permission.permission})
                              </span>
                              <IconButton
                                label={`Detach ${permission.name}`}
                                icon={<img src={cancelIcon} alt="" />}
                                onClick={() => void handleDetach(selectedRole.id, permission.id)}
                              />
                            </li>
                          ))}
                        </ul>
                        <div
                          className="settings-form settings-form-stack"
                          style={{ marginTop: "var(--space-4)" }}
                        >
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
                      </div>
                    </>
                  ) : (
                    <ul className="settings-detail-list">
                      {selectedRole.permissions.map((permission) => (
                        <li key={permission.id}>
                          <span className="settings-detail-list-label">
                            {permission.name} ({permission.permission})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
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
            error={createForm.fieldError("name")}
            onBlur={() => createForm.onBlur("name", name)}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Description"
            name="role-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </form>
      </Modal>
    </section>
  );
}
