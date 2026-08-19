import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { useEntityContext } from "../../entity/EntityContext";
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

function dedupeById(rows: ContractSummary[]): ContractSummary[] {
  const seen = new Set<string>();
  const unique: ContractSummary[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

type ContractsPageProps = {
  me: MeResponse;
};

export function ContractsPage({ me }: ContractsPageProps) {
  const navigate = useNavigate();
  const { selectedEntity, isAllEntities, entityHeaderValue } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const canDelete = canViewFinancials && me.permissions.includes("manage_contracts");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const contextLabel = isAllEntities ? "All Entities" : selectedEntity?.name ?? "Entity";

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError, response } = await apiClient.GET("/contracts", {
      params: {
        query: {
          status,
          q: query.trim() || undefined,
        },
        header: {
          "X-Entity-Id": entityHeaderValue,
        },
      },
    });
    if (!response.ok || apiError || !data) {
      setError("Could not load contracts.");
      setContracts([]);
      setLoading(false);
      return;
    }
    setContracts(dedupeById(data.contracts));
    setLoading(false);
  }, [entityHeaderValue, query, status]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  async function handleDelete(contract: ContractSummary) {
    if (!canDelete) {
      return;
    }
    if (isAllEntities) {
      setError("Select a single entity to delete a contract.");
      return;
    }
    if (!window.confirm(`Delete contract ${contract.reference}?`)) {
      return;
    }
    setDeletingId(contract.id);
    const { response } = await apiClient.DELETE("/contracts/{contractId}", {
      params: {
        path: { contractId: contract.id },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    setDeletingId(null);
    if (!response.ok) {
      setError("Could not delete contract.");
      return;
    }
    await loadContracts();
  }

  const statusPills = useMemo(() => Object.entries(STATUS_LABELS) as [StatusFilter, string][], []);

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
            placeholder="Search reference or closure owner"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
            onClick={() => setStatus(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}
      {loading ? <p>Loading contracts…</p> : null}

      {!loading && !error ? (
        <div className="contracts-table-wrap">
          <table className="contracts-table">
            <thead>
              <tr>
                <th>Contract Reference</th>
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
                  <td colSpan={7}>No contracts match this view.</td>
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
                      <button
                        type="button"
                        onClick={() => navigate(`/contracts/${contract.id}`)}
                      >
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
                          disabled={deletingId === contract.id || isAllEntities}
                          title={
                            isAllEntities
                              ? "Select a single entity to delete"
                              : undefined
                          }
                          onClick={() => void handleDelete(contract)}
                        >
                          {deletingId === contract.id ? "Deleting…" : "Delete"}
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
      ) : null}
    </div>
  );
}
