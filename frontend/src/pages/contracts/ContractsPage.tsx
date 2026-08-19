import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { Modal } from "../../components/Modal";
import { PaginationBar } from "../../components/PaginationBar";
import { useEntityContext } from "../../entity/EntityContext";
import { useListQueryParams } from "../../hooks/useListQueryParams";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
import "./ContractsPage.css";

type ContractSummary = components["schemas"]["ContractSummary"];
type MeResponse = components["schemas"]["MeResponse"];

type StatusFilter = "all" | "active" | "on_hold" | "support" | "cancelled";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  active: "Active",
  on_hold: "On Hold",
  support: "Support",
  cancelled: "Cancelled",
};

const CATEGORY_LABELS: Record<string, string> = {
  time_and_material: "Time & Material",
  data_management: "Data Management",
  contract_staffing: "Contract Staffing",
};

type ContractsPageProps = {
  me: MeResponse;
};

export function ContractsPage({ me }: ContractsPageProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedEntity, isAllEntities, entityHeaderValue } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const canDelete = canViewFinancials && me.permissions.includes("manage_contracts");
  const {
    search,
    searchInput,
    setSearchInput,
    page,
    pageSize,
    setPage,
    setPageSize,
    setExtra,
    extras,
  } = useListQueryParams({ extraKeys: ["status"] });
  const status = (extras.status as StatusFilter | undefined) ?? "all";
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContractSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const contextLabel = isAllEntities ? "All Entities" : selectedEntity?.name ?? "Entity";

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError, response } = await apiClient.GET("/contracts", {
      params: {
        query: {
          status,
          search: search.trim() || undefined,
          page,
          pageSize,
        },
        header: {
          "X-Entity-Id": entityHeaderValue,
        },
      },
    });
    if (!response.ok || apiError || !data) {
      setError("Could not load contracts.");
      setContracts([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setContracts(data.contracts);
    setTotal(data.total);
    setLoading(false);
  }, [entityHeaderValue, page, pageSize, search, status]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  async function confirmDelete() {
    if (!deleting || !canDelete) {
      return;
    }
    if (isAllEntities) {
      toast.error("Select a single entity to delete a contract.");
      return;
    }
    setDeleteBusy(true);
    const { error: apiError, response } = await apiClient.DELETE("/contracts/{contractId}", {
      params: {
        path: { contractId: deleting.id },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    setDeleteBusy(false);
    if (!response.ok || apiError) {
      toast.error(apiErrorMessage(apiError, "Could not delete contract."));
      return;
    }
    toast.success("Contract deleted.");
    setDeleting(null);
    await loadContracts();
  }

  const statusPills = useMemo(() => Object.entries(STATUS_LABELS) as [StatusFilter, string][], []);
  const emptyMessage =
    search.trim() !== "" || status !== "all"
      ? "No contracts match this view."
      : "No contracts yet.";

  return (
    <div className="contracts-page">
      <div className="contracts-toolbar">
        <div className="contracts-toolbar-left">
          <span className="contracts-entity-pill" data-testid="entity-pill">
            {contextLabel}
          </span>
          <input
            className="contracts-search"
            type="search"
            placeholder="Search reference, closure owner, or client"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search contracts"
          />
        </div>
        <button
          type="button"
          className="contracts-new-btn"
          disabled={isAllEntities}
          title={isAllEntities ? "Select a single entity to create a contract" : undefined}
          onClick={() => navigate("/contracts/new")}
        >
          + New Contract
        </button>
      </div>

      <div className="contracts-status-pills" role="tablist" aria-label="Status filter">
        {statusPills.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            className={`contracts-status-pill${status === value ? " is-active" : ""}`}
            onClick={() => setExtra("status", value === "all" ? null : value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}
      {loading ? <p>Loading contracts…</p> : null}

      {!loading && !error ? (
        <>
          <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr>
                  <th>Contract Reference</th>
                  <th>Client</th>
                  <th>Category</th>
                  <th>Closure Owner</th>
                  <th>Contract Period</th>
                  <th>Payment Type / Value</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan={8}>{emptyMessage}</td>
                  </tr>
                ) : (
                  contracts.map((contract) => (
                    <tr key={contract.id}>
                      <td>
                        {contract.reference}
                        {contract.isDraft ? (
                          <span className="contracts-badge status-support" style={{ marginLeft: 8 }}>
                            Draft
                          </span>
                        ) : null}
                      </td>
                      <td>{contract.clientName ?? "—"}</td>
                      <td>{CATEGORY_LABELS[contract.category] ?? contract.category}</td>
                      <td>{contract.closureOwnerName ?? "—"}</td>
                      <td>
                        {contract.startDate && contract.endDate
                          ? `${contract.startDate} – ${contract.endDate}`
                          : "—"}
                      </td>
                      <td>
                        {canViewFinancials
                          ? contract.paymentDisplay ?? "—"
                          : contract.paymentDisplay || (contract.paymentType ? "Restricted" : "—")}
                      </td>
                      <td>
                        {contract.projectStatus ? (
                          <span className={`contracts-badge status-${contract.projectStatus}`}>
                            {STATUS_LABELS[contract.projectStatus as StatusFilter] ??
                              contract.projectStatus}
                          </span>
                        ) : (
                          <span className="contracts-badge status-support">Draft</span>
                        )}
                      </td>
                      <td className="contracts-actions">
                        <button type="button" onClick={() => navigate(`/contracts/${contract.id}`)}>
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              contract.isDraft
                                ? `/contracts/${contract.id}/setup/2`
                                : `/contracts/${contract.id}/edit`,
                            )
                          }
                        >
                          Edit
                        </button>
                        {canDelete ? (
                          <button
                            type="button"
                            disabled={isAllEntities}
                            title={
                              isAllEntities ? "Select a single entity to delete" : undefined
                            }
                            onClick={() => setDeleting(contract)}
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="Delete requires Finance permissions"
                          >
                            Delete
                          </button>
                        )}
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
        open={Boolean(deleting)}
        title="Delete Contract"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button type="button" className="settings-secondary" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="settings-primary"
              disabled={deleteBusy}
              onClick={() => void confirmDelete()}
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <p>
          Delete contract <strong>{deleting?.reference}</strong>? It will be hidden from the list.
        </p>
      </Modal>
    </div>
  );
}
