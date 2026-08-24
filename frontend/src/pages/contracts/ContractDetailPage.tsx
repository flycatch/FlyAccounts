import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { useEntityContext } from "../../entity/EntityContext";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
import "./ContractsPage.css";

type MeResponse = components["schemas"]["MeResponse"];
type ContractDetail = components["schemas"]["ContractDetail"];

const CATEGORY_LABELS: Record<string, string> = {
  time_and_material: "Time & Material",
  data_management: "Data Management",
  contract_staffing: "Contract Staffing",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  on_hold: "On Hold",
  support: "Support",
  cancelled: "Cancelled",
};

type ContractDetailPageProps = {
  me: MeResponse;
};

export function ContractDetailPage({ me }: ContractDetailPageProps) {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { entityHeaderValue, isAllEntities } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const canDelete =
    me.permissions.includes("manage_contracts") &&
    me.permissions.includes("view_contract_financials");
  const canCreateProforma = me.permissions.includes("manage_proformas");
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, response } = await apiClient.GET("/contracts/{contractId}", {
        params: {
          path: { contractId },
          header: { "X-Entity-Id": entityHeaderValue },
        },
      });
      if (cancelled) {
        return;
      }
      if (!response.ok || !data) {
        setError("Contract was not found.");
        setLoading(false);
        return;
      }
      setContract(data);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [contractId, entityHeaderValue]);

  async function handleDelete() {
    if (!window.confirm("Delete this contract? It will be hidden from the list.")) {
      return;
    }
    if (isAllEntities) {
      toast.error("Select a single entity to delete a contract.");
      return;
    }
    setDeleting(true);
    const { error: apiError, response } = await apiClient.DELETE("/contracts/{contractId}", {
      params: {
        path: { contractId },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    setDeleting(false);
    if (!response.ok || apiError) {
      toast.error(apiErrorMessage(apiError, "Could not delete contract."));
      return;
    }
    toast.success("Contract deleted.");
    navigate("/contracts");
  }

  if (loading) {
    return <p>Loading contract…</p>;
  }
  if (!contract) {
    return (
      <div className="contracts-page">
        <p className="contracts-error">{error ?? "Contract was not found."}</p>
        <Link to="/contracts">← Back to contracts</Link>
      </div>
    );
  }

  const isTimeAndMaterial = contract.category === "time_and_material";

  return (
    <div className="contracts-page contract-detail">
      <div className="contracts-toolbar">
        <div className="contracts-toolbar-left">
          <Link to="/contracts" className="contract-create-back">
            ← Contracts
          </Link>
          <h2 style={{ margin: 0 }}>{contract.reference}</h2>
          {contract.isDraft ? (
            <span className="contracts-badge status-support">Draft</span>
          ) : null}
        </div>
        <div className="contracts-actions">
          {canCreateProforma && !contract.isDraft ? (
            <button
              type="button"
              onClick={() => navigate(`/proformas/new?contractId=${contract.id}`)}
            >
              Create Proforma
            </button>
          ) : null}
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
            <button type="button" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}

      <section className="contract-detail-section">
        <h3>Upload & category</h3>
        <dl className="contract-detail-grid">
          <div>
            <dt>Reference</dt>
            <dd>{contract.reference}</dd>
          </div>

          <div>
            <dt>Category</dt>
            <dd>{CATEGORY_LABELS[contract.category] ?? contract.category}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{contract.currency}</dd>
          </div>
          <div>
            <dt>Client</dt>
            <dd>{contract.clientName ?? "—"}</dd>
          </div>
          <div>
            <dt>Amendment</dt>
            <dd>{contract.isAmendment ? "Yes" : "No"}</dd>
          </div>
          {contract.isAmendment ? (
            <div>
              <dt>Parent Contract</dt>
              <dd>{contract.parentContractReference ?? contract.parentContractId ?? "—"}</dd>
            </div>
          ) : null}
          <div>
            <dt>Contract Document</dt>
            <dd>
              {contract.clientFileName || contract.clientFileKey ? (
                <span data-testid="client-file-link">
                  {contract.clientFileName ?? contract.clientFileKey}
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="contract-detail-section">
        <h3>Closure & period</h3>
        <dl className="contract-detail-grid">
          <div>
            <dt>Closure Owner</dt>
            <dd>{contract.closureOwnerName ?? "—"}</dd>
          </div>
          <div>
            <dt>Contract Period Start Date</dt>
            <dd>{contract.startDate ?? "—"}</dd>
          </div>
          <div>
            <dt>Contract Period End Date</dt>
            <dd>{contract.endDate ?? "—"}</dd>
          </div>
          <div>
            <dt>Project Status</dt>
            <dd>
              {contract.projectStatus
                ? (STATUS_LABELS[contract.projectStatus] ?? contract.projectStatus)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>PMO Note</dt>
            <dd>{contract.pmoNote || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="contract-detail-section">
        <h3>Payment & milestones</h3>
        <dl className="contract-detail-grid">
          <div>
            <dt>Payment Type</dt>
            <dd>
              {contract.paymentType === "monthly"
                ? "Monthly × Months"
                : contract.paymentType === "project_value"
                  ? "Project Value"
                  : "—"}
            </dd>
          </div>
          {contract.paymentType === "project_value" ? (
            <div>
              <dt>Total project value</dt>
              <dd>
                {canViewFinancials
                  ? contract.projectValue
                    ? `${contract.currency} ${contract.projectValue}`
                    : "—"
                  : contract.paymentDisplay || "Restricted"}
              </dd>
            </div>
          ) : null}
          {contract.paymentType === "monthly" ? (
            <>
              <div>
                <dt>Monthly Payment Amount</dt>
                <dd>
                  {canViewFinancials
                    ? contract.monthlyRate
                      ? `${contract.currency} ${contract.monthlyRate}`
                      : "—"
                    : "Restricted"}
                </dd>
              </div>
              <div>
                <dt>Months</dt>
                <dd>{contract.months ?? "—"}</dd>
              </div>
            </>
          ) : null}
        </dl>
        {isTimeAndMaterial ? (
          contract.milestones && contract.milestones.length > 0 ? (
            <div className="contracts-table-wrap">
              <table className="contracts-table" data-testid="milestones-table">
                <thead>
                  <tr>
                    <th>Milestone</th>
                    {canViewFinancials ? <th>Value</th> : null}
                    <th>Due Conditions</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.milestones.map((row) => (
                    <tr key={`${row.name}-${row.sortOrder}`}>
                      <td>{row.name}</td>
                      {canViewFinancials ? <td>{row.value}</td> : null}
                      <td>{row.dueConditionOrDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="contract-hint">No milestones.</p>
          )
        ) : null}
      </section>
    </div>
  );
}
