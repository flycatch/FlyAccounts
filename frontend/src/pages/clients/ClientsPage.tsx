import { useCallback, useEffect, useMemo, useState } from "react";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { IconButton } from "../../components/IconButton";
import editIcon from "../../assets/icons/edit.svg";
import deleteIcon from "../../assets/icons/delete.svg";
import { Modal } from "../../components/Modal";
import { PaginationBar } from "../../components/PaginationBar";
import { TextField } from "../../components/TextField";
import { TextareaField } from "../../components/TextareaField";
import { emailFormat, required, useFormErrors } from "../../hooks/useFormErrors";
import { useListQueryParams } from "../../hooks/useListQueryParams";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
import "../../components/settings.css";
import "../contracts/ContractsPage.css";
import "./ClientsPage.css";

type Client = components["schemas"]["Client"];

type ClientForm = {
  name: string;
  address: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  vatNumber: string;
  notes: string;
};

const emptyForm: ClientForm = {
  name: "",
  address: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  vatNumber: "",
  notes: "",
};

type ModalMode = "create" | "edit" | "view" | "delete" | null;

export function ClientsPage() {
  const toast = useToast();
  const { search, searchInput, setSearchInput, page, pageSize, setPage, setPageSize } =
    useListQueryParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModalMode>(null);
  const [active, setActive] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const validators = useMemo(
    () => ({
      name: required("Name"),
      address: required("Address"),
      contactPerson: required("Contact Person"),
      contactEmail: emailFormat("Contact Email"),
      contactPhone: required("Contact Phone"),
      vatNumber: required("VAT/Tax Registration Number"),
    }),
    [],
  );
  const { fieldError, onBlur, validateAll, clearErrors } = useFormErrors(validators);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, response } = await apiClient.GET("/clients", {
      params: {
        query: {
          search: search || undefined,
          page,
          pageSize,
        },
      },
    });
    if (!response.ok || !data) {
      setError("Could not load clients.");
      setClients([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setClients(data.clients);
    setTotal(data.total);
    setLoading(false);
  }, [page, pageSize, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    clearErrors();
    setForm(emptyForm);
    setActive(null);
    setMode("create");
  }

  function openView(client: Client) {
    clearErrors();
    setActive(client);
    setForm({
      name: client.name,
      address: client.address,
      contactPerson: client.contactPerson,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      vatNumber: client.vatNumber,
      notes: client.notes ?? "",
    });
    setMode("view");
  }

  function openEdit(client: Client) {
    clearErrors();
    setActive(client);
    setForm({
      name: client.name,
      address: client.address,
      contactPerson: client.contactPerson,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      vatNumber: client.vatNumber,
      notes: client.notes ?? "",
    });
    setMode("edit");
  }

  function openDelete(client: Client) {
    setActive(client);
    setMode("delete");
  }

  function updateField<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    const values = {
      name: form.name,
      address: form.address,
      contactPerson: form.contactPerson,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      vatNumber: form.vatNumber,
    };
    if (!validateAll(values)) {
      return;
    }
    setSaving(true);
    const body = {
      name: form.name.trim(),
      address: form.address.trim(),
      contactPerson: form.contactPerson.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      vatNumber: form.vatNumber.trim(),
      notes: form.notes.trim() || undefined,
    };
    const result =
      mode === "edit" && active
        ? await apiClient.PATCH("/clients/{clientId}", {
            params: { path: { clientId: active.id } },
            body,
          })
        : await apiClient.POST("/clients", { body });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(apiErrorMessage(result.error, "The client could not be saved."));
      return;
    }
    toast.success(mode === "edit" ? "Client updated." : "Client created.");
    setMode(null);
    await load();
  }

  async function handleDelete() {
    if (!active) {
      return;
    }
    setSaving(true);
    const { error: apiError, response } = await apiClient.DELETE("/clients/{clientId}", {
      params: { path: { clientId: active.id } },
    });
    setSaving(false);
    if (apiError || (response && !response.ok)) {
      toast.error(apiErrorMessage(apiError, "The client could not be deleted."));
      return;
    }
    toast.success("Client deleted.");
    setMode(null);
    setActive(null);
    await load();
  }

  const readOnly = mode === "view";
  const emptyMessage =
    search.trim() !== "" ? "No clients match this search." : "No clients yet.";

  return (
    <div className="clients-page contracts-page">
      <div className="contracts-toolbar">
        <div className="contracts-toolbar-left">
          <input
            className="contracts-search"
            type="search"
            placeholder="Search clients"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search clients"
          />
        </div>
        <button type="button" className="contracts-new-btn" onClick={openCreate}>
          + New Client
        </button>
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}
      {loading ? <p>Loading clients…</p> : null}

      {!loading && !error ? (
        <>
          <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>VAT</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{emptyMessage}</td>
                  </tr>
                ) : (
                  clients.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.contactPerson}</td>
                      <td>{item.contactEmail}</td>
                      <td>{item.contactPhone}</td>
                      <td>{item.vatNumber}</td>
                      <td className="contracts-actions">
                        <IconButton
                          label="View client"
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          }
                          onClick={() => openView(item)}
                        />
                        <IconButton
                          label="Edit client"
                          icon={<img src={editIcon} alt="" />}
                          onClick={() => openEdit(item)}
                        />
                        <IconButton
                          label="Delete client"
                          icon={<img src={deleteIcon} alt="" />}
                          danger
                          onClick={() => openDelete(item)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
        open={mode === "create" || mode === "edit" || mode === "view"}
        title={mode === "create" ? "Create Client" : mode === "edit" ? "Edit Client" : "View Client"}
        onClose={() => setMode(null)}
        footer={
          readOnly ? (
            <button type="button" className="settings-secondary" onClick={() => setMode(null)}>
              Close
            </button>
          ) : (
            <>
              <button type="button" className="settings-secondary" onClick={() => setMode(null)}>
                Cancel
              </button>
              <button
                type="submit"
                form="client-form"
                className="settings-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : mode === "edit" ? "Save" : "Create"}
              </button>
            </>
          )
        }
      >
        <form
          id="client-form"
          className="settings-form settings-form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!readOnly) {
              void handleSave();
            }
          }}
        >
          <TextField
            label="Name"
            name="client-name"
            value={form.name}
            disabled={readOnly}
            error={fieldError("name")}
            onBlur={() => onBlur("name", form.name)}
            onChange={(event) => updateField("name", event.target.value)}
          />
          <TextareaField
            label="Address"
            name="client-address"
            value={form.address}
            disabled={readOnly}
            error={fieldError("address")}
            onBlur={() => onBlur("address", form.address)}
            onChange={(event) => updateField("address", event.target.value)}
          />
          <TextField
            label="Contact Person"
            name="client-contact-person"
            value={form.contactPerson}
            disabled={readOnly}
            error={fieldError("contactPerson")}
            onBlur={() => onBlur("contactPerson", form.contactPerson)}
            onChange={(event) => updateField("contactPerson", event.target.value)}
          />
          <TextField
            label="Contact Email"
            name="client-contact-email"
            type="email"
            value={form.contactEmail}
            disabled={readOnly}
            error={fieldError("contactEmail")}
            onBlur={() => onBlur("contactEmail", form.contactEmail)}
            onChange={(event) => updateField("contactEmail", event.target.value)}
          />
          <TextField
            label="Contact Phone"
            name="client-contact-phone"
            value={form.contactPhone}
            disabled={readOnly}
            error={fieldError("contactPhone")}
            onBlur={() => onBlur("contactPhone", form.contactPhone)}
            onChange={(event) => updateField("contactPhone", event.target.value)}
          />
          <TextField
            label="VAT/Tax Registration Number"
            name="client-vat"
            value={form.vatNumber}
            disabled={readOnly}
            error={fieldError("vatNumber")}
            onBlur={() => onBlur("vatNumber", form.vatNumber)}
            onChange={(event) => updateField("vatNumber", event.target.value)}
          />
          <TextareaField
            label="Notes"
            name="client-notes"
            value={form.notes}
            disabled={readOnly}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={mode === "delete"}
        title="Delete Client"
        onClose={() => setMode(null)}
        footer={
          <>
            <button type="button" className="settings-secondary" onClick={() => setMode(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="settings-primary"
              disabled={saving}
              onClick={() => void handleDelete()}
            >
              {saving ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p>
          Delete <strong>{active?.name}</strong>? This cannot be undone if the client is not linked to
          contracts.
        </p>
      </Modal>
    </div>
  );
}
