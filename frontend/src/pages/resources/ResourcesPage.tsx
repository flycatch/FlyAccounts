import { useCallback, useEffect, useMemo, useState } from "react";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { IconButton } from "../../components/IconButton";
import editIcon from "../../assets/icons/edit.svg";
import deleteIcon from "../../assets/icons/delete.svg";
import { Modal } from "../../components/Modal";
import { PaginationBar } from "../../components/PaginationBar";
import { PillToggle } from "../../components/PillToggle";
import { SearchableSelect } from "../../components/SearchableSelect";
import { TextField } from "../../components/TextField";
import { useEntityContext } from "../../entity/EntityContext";
import { required, requiredNumber, useFormErrors } from "../../hooks/useFormErrors";
import { useListQueryParams } from "../../hooks/useListQueryParams";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
import "../../components/settings.css";
import "../contracts/ContractsPage.css";
import "./ResourcesPage.css";

type Resource = components["schemas"]["Resource"];
type ResourceType = components["schemas"]["Resource"]["resourceType"];

type ResourceForm = {
  resourceType: ResourceType;
  name: string;
  monthlyAllocationPercent: string;
  contractId: string;
  month: string;
};

const emptyForm: ResourceForm = {
  resourceType: "inhouse",
  name: "",
  monthlyAllocationPercent: "",
  contractId: "",
  month: "",
};

const TYPE_OPTIONS = [
  { value: "inhouse" as const, label: "Inhouse" },
  { value: "vendor" as const, label: "Vendor" },
  { value: "both" as const, label: "Both" },
];

const TYPE_LABELS: Record<ResourceType, string> = {
  inhouse: "Inhouse",
  vendor: "Vendor",
  both: "Both",
};

const SORTABLE_COLUMNS = [
  { key: "resourceType", label: "Resource Type" },
  { key: "name", label: "Resource Name" },
  { key: "monthlyAllocationPercent", label: "Allocation %" },
  { key: "contract", label: "Contract" },
  { key: "month", label: "Month" },
] as const;

type ModalMode = "create" | "edit" | "view" | "delete" | null;

export function ResourcesPage() {
  const toast = useToast();
  const { selectedEntity, isAllEntities, entityHeaderValue } = useEntityContext();
  const {
    search,
    searchInput,
    setSearchInput,
    page,
    pageSize,
    setPage,
    setPageSize,
    sortBy,
    sortOrder,
    setSort,
  } = useListQueryParams({ defaultSortBy: "name" });

  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModalMode>(null);
  const [active, setActive] = useState<Resource | null>(null);
  const [form, setForm] = useState<ResourceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [contractOptions, setContractOptions] = useState<{ value: string; label: string }[]>([]);
  const [contractQuery, setContractQuery] = useState("");

  const validators = useMemo(
    () => ({
      name: required("Resource Name"),
      monthlyAllocationPercent: requiredNumber("Monthly Allocation %"),
      contractId: required("Contract"),
      month: required("Month"),
      resourceType: required("Resource Type"),
    }),
    [],
  );
  const { fieldError, onBlur, validateAll, clearErrors } = useFormErrors(validators);

  const contextLabel = isAllEntities ? "All Entities" : selectedEntity?.name ?? "Entity";
  const effectiveSortBy = sortBy || "name";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, response } = await apiClient.GET("/resources", {
      params: {
        query: {
          search: search || undefined,
          page,
          pageSize,
          sortBy: effectiveSortBy as
            | "resourceType"
            | "name"
            | "monthlyAllocationPercent"
            | "contract"
            | "month",
          sortOrder,
        },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    if (!response.ok || !data) {
      setError("Could not load resources.");
      setResources([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setResources(data.resources);
    setTotal(data.total);
    setLoading(false);
  }, [effectiveSortBy, entityHeaderValue, page, pageSize, search, sortOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadContracts = useCallback(
    async (query: string) => {
      if (isAllEntities) {
        setContractOptions([]);
        return;
      }
      const { data, response } = await apiClient.GET("/contracts", {
        params: {
          query: {
            search: query.trim() || undefined,
            page: 1,
            pageSize: 50,
            status: "all",
          },
          header: { "X-Entity-Id": entityHeaderValue },
        },
      });
      if (!response.ok || !data) {
        setContractOptions([]);
        return;
      }
      setContractOptions(
        data.contracts.map((item) => ({
          value: item.id,
          label: item.reference,
        })),
      );
    },
    [entityHeaderValue, isAllEntities],
  );

  useEffect(() => {
    if (mode !== "create" && mode !== "edit") {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadContracts(contractQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [contractQuery, loadContracts, mode]);

  function openCreate() {
    clearErrors();
    setForm(emptyForm);
    setActive(null);
    setContractQuery("");
    setMode("create");
  }

  function openView(resource: Resource) {
    clearErrors();
    setActive(resource);
    setForm({
      resourceType: resource.resourceType,
      name: resource.name,
      monthlyAllocationPercent: String(resource.monthlyAllocationPercent),
      contractId: resource.contractId,
      month: resource.month,
    });
    setContractOptions([{ value: resource.contractId, label: resource.contractReference }]);
    setMode("view");
  }

  function openEdit(resource: Resource) {
    clearErrors();
    setActive(resource);
    setForm({
      resourceType: resource.resourceType,
      name: resource.name,
      monthlyAllocationPercent: String(resource.monthlyAllocationPercent),
      contractId: resource.contractId,
      month: resource.month,
    });
    setContractOptions([{ value: resource.contractId, label: resource.contractReference }]);
    setContractQuery("");
    setMode("edit");
  }

  function openDelete(resource: Resource) {
    setActive(resource);
    setMode("delete");
  }

  function updateField<K extends keyof ResourceForm>(key: K, value: ResourceForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    const values = {
      name: form.name,
      monthlyAllocationPercent: form.monthlyAllocationPercent,
      contractId: form.contractId,
      month: form.month,
      resourceType: form.resourceType,
    };
    if (!validateAll(values)) {
      return;
    }
    if (isAllEntities) {
      toast.error("Select a single entity to save a resource.");
      return;
    }
    setSaving(true);
    const body = {
      resourceType: form.resourceType,
      name: form.name.trim(),
      monthlyAllocationPercent: Number(form.monthlyAllocationPercent),
      contractId: form.contractId,
      month: form.month,
    };
    const result =
      mode === "edit" && active
        ? await apiClient.PATCH("/resources/{resourceId}", {
            params: {
              path: { resourceId: active.id },
              header: { "X-Entity-Id": entityHeaderValue },
            },
            body,
          })
        : await apiClient.POST("/resources", {
            params: { header: { "X-Entity-Id": entityHeaderValue } },
            body,
          });
    setSaving(false);
    if (result.error || !result.data) {
      toast.error(apiErrorMessage(result.error, "The resource could not be saved."));
      return;
    }
    toast.success(mode === "edit" ? "Resource updated." : "Resource created.");
    setMode(null);
    await load();
  }

  async function handleDelete() {
    if (!active) {
      return;
    }
    if (isAllEntities) {
      toast.error("Select a single entity to delete a resource.");
      return;
    }
    setSaving(true);
    const { error: apiError, response } = await apiClient.DELETE("/resources/{resourceId}", {
      params: {
        path: { resourceId: active.id },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    setSaving(false);
    if (apiError || (response && !response.ok)) {
      toast.error(apiErrorMessage(apiError, "The resource could not be deleted."));
      return;
    }
    toast.success("Resource deleted.");
    setMode(null);
    setActive(null);
    await load();
  }

  const readOnly = mode === "view";
  const emptyMessage =
    search.trim() !== "" ? "No resources match this search." : "No resources yet.";

  function sortIndicator(column: string) {
    if (effectiveSortBy !== column) {
      return "";
    }
    return sortOrder === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="resources-page contracts-page">
      <div className="contracts-toolbar">
        <div className="contracts-toolbar-left">
          <span className="contracts-entity-pill" data-testid="entity-pill">
            {contextLabel}
          </span>
          <input
            className="contracts-search"
            type="search"
            placeholder="Search resources"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search resources"
          />
        </div>
        <button
          type="button"
          className="contracts-new-btn"
          disabled={isAllEntities}
          title={isAllEntities ? "Select a single entity to add a resource" : undefined}
          onClick={openCreate}
        >
          + Add Resource
        </button>
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}
      {loading ? <p>Loading resources…</p> : null}

      {!loading && !error ? (
        <>
          <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr>
                  {SORTABLE_COLUMNS.map((column) => (
                    <th key={column.key}>
                      <button
                        type="button"
                        className="resources-sort-btn"
                        onClick={() => setSort(column.key)}
                      >
                        {column.label}
                        {sortIndicator(column.key)}
                      </button>
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.length === 0 ? (
                  <tr>
                    <td colSpan={6}>{emptyMessage}</td>
                  </tr>
                ) : (
                  resources.map((item) => (
                    <tr key={item.id}>
                      <td>{TYPE_LABELS[item.resourceType]}</td>
                      <td>{item.name}</td>
                      <td>
                        <span className="resources-allocation">
                          {item.monthlyAllocationPercent}%
                          {item.monthlyAllocationPercent > 100 ? (
                            <span className="resources-over-pill" data-testid="over-allocated-pill">
                              Over allocated
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td>{item.contractReference}</td>
                      <td>{item.month}</td>
                      <td className="contracts-actions">
                        <IconButton
                          label="View resource"
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          }
                          onClick={() => openView(item)}
                        />
                        <IconButton
                          label="Edit resource"
                          disabled={isAllEntities}
                          title={isAllEntities ? "Select a single entity to edit" : undefined}
                          icon={<img src={editIcon} alt="" />}
                          onClick={() => openEdit(item)}
                        />
                        <IconButton
                          label="Delete resource"
                          disabled={isAllEntities}
                          title={isAllEntities ? "Select a single entity to delete" : undefined}
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
        title={
          mode === "create" ? "Add Resource" : mode === "edit" ? "Edit Resource" : "View Resource"
        }
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
                form="resource-form"
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
          id="resource-form"
          className="settings-form settings-form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!readOnly) {
              void handleSave();
            }
          }}
        >
          <PillToggle
            label="Resource Type"
            name="resource-type"
            options={TYPE_OPTIONS}
            value={form.resourceType}
            error={fieldError("resourceType")}
            onChange={(value) => {
              if (readOnly) {
                return;
              }
              updateField("resourceType", value);
              onBlur("resourceType", value);
            }}
          />
          <TextField
            label="Resource Name"
            name="resource-name"
            value={form.name}
            disabled={readOnly}
            error={fieldError("name")}
            onBlur={() => onBlur("name", form.name)}
            onChange={(event) => updateField("name", event.target.value)}
          />
          <TextField
            label="Monthly Allocation %"
            name="resource-allocation"
            type="number"
            value={form.monthlyAllocationPercent}
            disabled={readOnly}
            error={fieldError("monthlyAllocationPercent")}
            onBlur={() => onBlur("monthlyAllocationPercent", form.monthlyAllocationPercent)}
            onChange={(event) => updateField("monthlyAllocationPercent", event.target.value)}
          />
          <SearchableSelect
            label="Contract"
            value={form.contractId}
            options={contractOptions}
            placeholder="Search contracts…"
            disabled={readOnly}
            error={fieldError("contractId")}
            onBlur={() => onBlur("contractId", form.contractId)}
            onSearchChange={setContractQuery}
            onChange={(value) => {
              updateField("contractId", value);
              onBlur("contractId", value);
            }}
          />
          <TextField
            label="Month"
            name="resource-month"
            type="month"
            value={form.month}
            disabled={readOnly}
            error={fieldError("month")}
            onBlur={() => onBlur("month", form.month)}
            onChange={(event) => updateField("month", event.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={mode === "delete"}
        title="Delete Resource"
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
          Delete resource <strong>{active?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
