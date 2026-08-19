import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { PillToggle } from "../../components/PillToggle";
import { SelectField } from "../../components/SelectField";
import { TextField } from "../../components/TextField";
import { useEntityContext } from "../../entity/EntityContext";
import "./ContractsPage.css";
import "./create/ContractCreate.css";

type MeResponse = components["schemas"]["MeResponse"];
type ContractDetail = components["schemas"]["ContractDetail"];

type MilestoneDraft = {
  name: string;
  value: string;
  dueConditionOrDate: string;
};

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "support", label: "Support" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  time_and_material: "Time & Material",
  data_management: "Data Management",
  contract_staffing: "Contract Staffing",
};

type ContractEditPageProps = {
  me: MeResponse;
};

export function ContractEditPage({ me }: ContractEditPageProps) {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const { isAllEntities, entityHeaderValue } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [owners, setOwners] = useState<{ id: string; displayName: string }[]>([]);
  const [closureOwnerUserId, setClosureOwnerUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectStatus, setProjectStatus] = useState<(typeof STATUSES)[number]["value"]>("active");
  const [pmoNote, setPmoNote] = useState("");
  const [paymentType, setPaymentType] = useState<"project_value" | "monthly">("project_value");
  const [projectValue, setProjectValue] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [months, setMonths] = useState("1");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { name: "", value: "", dueConditionOrDate: "" },
  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [detail, ownersRes] = await Promise.all([
        apiClient.GET("/contracts/{contractId}", {
          params: {
            path: { contractId },
            header: { "X-Entity-Id": entityHeaderValue },
          },
        }),
        apiClient.GET("/contracts/closure-owners"),
      ]);
      if (cancelled) {
        return;
      }
      if (!detail.response.ok || !detail.data) {
        setError("Could not load contract.");
        setLoading(false);
        return;
      }
      const data = detail.data;
      setContract(data);
      if (ownersRes.response.ok && ownersRes.data) {
        setOwners(ownersRes.data.owners);
      }
      setClosureOwnerUserId(data.closureOwnerUserId ?? me.id);
      setStartDate(data.startDate ?? "");
      setEndDate(data.endDate ?? "");
      if (data.projectStatus) {
        setProjectStatus(data.projectStatus);
      }
      setPmoNote(data.pmoNote ?? "");
      if (data.paymentType) {
        setPaymentType(data.paymentType);
      }
      setProjectValue(data.projectValue ?? "");
      setMonthlyRate(data.monthlyRate ?? "");
      setMonths(data.months ? String(data.months) : "1");
      if (data.milestones && data.milestones.length > 0) {
        setMilestones(
          data.milestones.map((item) => ({
            name: item.name,
            value: item.value,
            dueConditionOrDate: item.dueConditionOrDate,
          })),
        );
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [contractId, entityHeaderValue, me.id]);

  const cumulativeValues = useMemo(() => {
    let running = 0;
    return milestones.map((item) => {
      const amount = Number.parseFloat(item.value || "0");
      running += Number.isFinite(amount) ? amount : 0;
      return running.toFixed(2);
    });
  }, [milestones]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!closureOwnerUserId) {
      next.owner = "Closure owner is required.";
    }
    if (!startDate) {
      next.startDate = "Start date is required.";
    }
    if (!endDate) {
      next.endDate = "End date is required.";
    }
    if (startDate && endDate && endDate < startDate) {
      next.endDate = "End date must be on or after the start date.";
    }
    if (canViewFinancials) {
      if (paymentType === "project_value" && !projectValue.trim()) {
        next.projectValue = "Project value is required.";
      }
      if (paymentType === "monthly") {
        if (!monthlyRate.trim()) {
          next.monthlyRate = "Monthly rate is required.";
        }
        if (!months.trim() || Number.parseInt(months, 10) < 1) {
          next.months = "Number of months is required.";
        }
      }
    }
    if (contract?.category === "time_and_material") {
      if (!milestones.some((row) => row.name.trim())) {
        next.milestones = "Add at least one milestone for Time & Material.";
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) {
      setError("Fix the highlighted fields before saving.");
      return;
    }
    if (isAllEntities) {
      setError("Select a single entity to edit a contract.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: components["schemas"]["UpdateContractRequest"] = {
      closureOwnerUserId,
      startDate,
      endDate,
      projectStatus,
      pmoNote: pmoNote || undefined,
      paymentType,
      milestones: milestones
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          name: item.name.trim(),
          value: canViewFinancials ? item.value || "0" : "0",
          dueConditionOrDate: item.dueConditionOrDate || startDate,
          sortOrder: index,
        })),
      complete: contract?.isDraft ? true : undefined,
    };
    if (canViewFinancials) {
      if (paymentType === "project_value") {
        body.projectValue = projectValue;
      } else {
        body.monthlyRate = monthlyRate;
        body.months = Number.parseInt(months, 10);
      }
    }

    const updated = await apiClient.PATCH("/contracts/{contractId}", {
      params: {
        path: { contractId },
        header: { "X-Entity-Id": entityHeaderValue },
      },
      body,
    });
    setSubmitting(false);
    if (!updated.response.ok || !updated.data) {
      const err = updated.error as { message?: string } | undefined;
      setError(err?.message || "Could not save contract.");
      return;
    }
    navigate(`/contracts/${contractId}`);
  }

  if (isAllEntities) {
    return <Navigate to="/contracts" replace />;
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
  if (contract.isDraft && (!contract.startDate || !contract.paymentType)) {
    return <Navigate to={`/contracts/${contractId}/setup/2`} replace />;
  }

  return (
    <div className="contracts-page contract-edit">
      <div className="contracts-toolbar">
        <div className="contracts-toolbar-left">
          <Link to={`/contracts/${contractId}`} className="contract-create-back">
            ← View
          </Link>
          <h2 style={{ margin: 0 }}>Edit {contract.reference}</h2>
        </div>
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}

      <section className="contract-detail-section">
        <h3>Upload & category</h3>
        <p className="contract-hint">
          {CATEGORY_LABELS[contract.category] ?? contract.category} · {contract.currency} ·{" "}
          {contract.isAmendment ? "Amendment" : "Original"} · Reference {contract.reference}{" "}
          (read-only)
        </p>
      </section>

      <section className="contract-detail-section contract-create-fields">
        <h3>Closure & period</h3>
        <SelectField
          label="Closure owner"
          value={closureOwnerUserId}
          error={fieldErrors.owner}
          onChange={(event) => {
            setClosureOwnerUserId(event.target.value);
            setFieldErrors((prev) => ({ ...prev, owner: "" }));
          }}
          onBlur={() => {
            if (!closureOwnerUserId) {
              setFieldErrors((prev) => ({ ...prev, owner: "Closure owner is required." }));
            }
          }}
        >
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.displayName}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Start date"
          type="date"
          value={startDate}
          error={fieldErrors.startDate}
          onChange={(event) => {
            setStartDate(event.target.value);
            setFieldErrors((prev) => ({ ...prev, startDate: "" }));
          }}
          onBlur={() => {
            if (!startDate) {
              setFieldErrors((prev) => ({ ...prev, startDate: "Start date is required." }));
            }
          }}
        />
        <TextField
          label="End date"
          type="date"
          value={endDate}
          error={fieldErrors.endDate}
          onChange={(event) => {
            setEndDate(event.target.value);
            setFieldErrors((prev) => ({ ...prev, endDate: "" }));
          }}
          onBlur={() => {
            if (!endDate) {
              setFieldErrors((prev) => ({ ...prev, endDate: "End date is required." }));
            } else if (startDate && endDate < startDate) {
              setFieldErrors((prev) => ({
                ...prev,
                endDate: "End date must be on or after the start date.",
              }));
            }
          }}
        />
        <PillToggle
          label="Project status"
          value={projectStatus}
          options={STATUSES}
          onChange={setProjectStatus}
        />
        <TextField
          label="PMO note"
          value={pmoNote}
          onChange={(event) => setPmoNote(event.target.value)}
        />
      </section>

      <section className="contract-detail-section contract-create-fields">
        <h3>Payment & milestones</h3>
        <PillToggle
          label="Payment type"
          value={paymentType}
          options={[
            { value: "project_value", label: "Project Value" },
            { value: "monthly", label: "Monthly × Months" },
          ]}
          onChange={setPaymentType}
        />
        {canViewFinancials ? (
          paymentType === "project_value" ? (
            <TextField
              label="Total project value"
              value={projectValue}
              error={fieldErrors.projectValue}
              onChange={(event) => {
                setProjectValue(event.target.value);
                setFieldErrors((prev) => ({ ...prev, projectValue: "" }));
              }}
              onBlur={() => {
                if (!projectValue.trim()) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    projectValue: "Project value is required.",
                  }));
                }
              }}
            />
          ) : (
            <>
              <TextField
                label="Monthly rate"
                value={monthlyRate}
                error={fieldErrors.monthlyRate}
                onChange={(event) => {
                  setMonthlyRate(event.target.value);
                  setFieldErrors((prev) => ({ ...prev, monthlyRate: "" }));
                }}
                onBlur={() => {
                  if (!monthlyRate.trim()) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      monthlyRate: "Monthly rate is required.",
                    }));
                  }
                }}
              />
              <TextField
                label="Number of months"
                type="number"
                value={months}
                error={fieldErrors.months}
                onChange={(event) => {
                  setMonths(event.target.value);
                  setFieldErrors((prev) => ({ ...prev, months: "" }));
                }}
                onBlur={() => {
                  if (!months.trim() || Number.parseInt(months, 10) < 1) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      months: "Number of months is required.",
                    }));
                  }
                }}
              />
            </>
          )
        ) : (
          <p className="contract-hint">Payment amounts are hidden for your role.</p>
        )}

        <div>
          <div className="contract-milestones-header">
            <h4>Milestones</h4>
            <button
              type="button"
              onClick={() =>
                setMilestones((rows) => [...rows, { name: "", value: "", dueConditionOrDate: "" }])
              }
            >
              + Add Milestone
            </button>
          </div>
          {fieldErrors.milestones ? (
            <span className="ui-field-error">{fieldErrors.milestones}</span>
          ) : null}
          <div className="contracts-table-wrap">
            <table className="contracts-table" data-testid="milestones-table">
              <thead>
                <tr>
                  <th>Name</th>
                  {canViewFinancials ? <th>Value</th> : null}
                  <th>Due condition</th>
                  {canViewFinancials ? <th>Cumulative</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {milestones.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        className="ui-control"
                        value={row.name}
                        onChange={(event) =>
                          setMilestones((rows) =>
                            rows.map((item, i) =>
                              i === index ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    </td>
                    {canViewFinancials ? (
                      <td>
                        <input
                          className="ui-control"
                          value={row.value}
                          onChange={(event) =>
                            setMilestones((rows) =>
                              rows.map((item, i) =>
                                i === index ? { ...item, value: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </td>
                    ) : null}
                    <td>
                      <input
                        className="ui-control"
                        value={row.dueConditionOrDate}
                        onChange={(event) =>
                          setMilestones((rows) =>
                            rows.map((item, i) =>
                              i === index
                                ? { ...item, dueConditionOrDate: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    {canViewFinancials ? <td>{cumulativeValues[index]}</td> : null}
                    <td>
                      <button
                        type="button"
                        onClick={() => setMilestones((rows) => rows.filter((_, i) => i !== index))}
                        disabled={milestones.length === 1}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="contract-create-footer">
        <button type="button" onClick={() => navigate(`/contracts/${contractId}`)} disabled={submitting}>
          Cancel
        </button>
        <button type="button" className="primary" disabled={submitting} onClick={() => void handleSave()}>
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
