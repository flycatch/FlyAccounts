import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../../api/schema";
import { apiClient } from "../../../api/client";
import { PillToggle } from "../../../components/PillToggle";
import { TextField } from "../../../components/TextField";
import { useEntityContext } from "../../../entity/EntityContext";
import { ContractCreateLayout } from "./ContractCreateLayout";

type MeResponse = components["schemas"]["MeResponse"];
type ContractDetail = components["schemas"]["ContractDetail"];

type MilestoneDraft = {
  name: string;
  value: string;
  dueConditionOrDate: string;
};

type Step3PaymentPageProps = {
  me: MeResponse;
};

export function Step3PaymentPage({ me }: Step3PaymentPageProps) {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const { isAllEntities, entityHeaderValue } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const [contract, setContract] = useState<ContractDetail | null>(null);
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
        setError("Could not load draft contract.");
        setLoading(false);
        return;
      }
      setContract(data);
      if (data.paymentType) {
        setPaymentType(data.paymentType);
      }
      if (data.projectValue) {
        setProjectValue(data.projectValue);
      }
      if (data.monthlyRate) {
        setMonthlyRate(data.monthlyRate);
      }
      if (data.months) {
        setMonths(String(data.months));
      }
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
  }, [contractId, entityHeaderValue]);

  const cumulativeValues = useMemo(() => {
    let running = 0;
    return milestones.map((item) => {
      const amount = Number.parseFloat(item.value || "0");
      running += Number.isFinite(amount) ? amount : 0;
      return running.toFixed(2);
    });
  }, [milestones]);

  function validate(showAll = false): boolean {
    const next: Record<string, string> = {};
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
      const named = milestones.filter((row) => row.name.trim());
      if (named.length === 0) {
        next.milestones = "Add at least one milestone for Time & Material.";
      }
    }
    if (showAll || Object.keys(fieldErrors).length) {
      setFieldErrors(next);
    }
    return Object.keys(next).length === 0;
  }

  async function handleComplete() {
    if (!validate(true)) {
      setError("Fix the highlighted fields before continuing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: components["schemas"]["UpdateContractRequest"] = {
      paymentType,
      milestones: milestones
        .filter((item) => item.name.trim())
        .map((item, index) => ({
          name: item.name.trim(),
          value: canViewFinancials ? item.value || "0" : "0",
          dueConditionOrDate: item.dueConditionOrDate || contract?.startDate || "",
          sortOrder: index,
        })),
      complete: true,
    };
    if (canViewFinancials) {
      if (paymentType === "project_value") {
        body.projectValue = projectValue;
      } else {
        body.monthlyRate = monthlyRate;
        body.months = Number.parseInt(months, 10);
      }
    } else if (paymentType === "project_value") {
      body.projectValue = "0";
    } else {
      body.monthlyRate = "0";
      body.months = Number.parseInt(months, 10) || 1;
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
      setError(err?.message || "Could not complete contract.");
      return;
    }
    navigate("/contracts");
  }

  if (isAllEntities) {
    return <Navigate to="/contracts" replace />;
  }
  if (loading) {
    return <p>Loading draft…</p>;
  }

  return (
    <ContractCreateLayout
      step={3}
      title="Payment terms & milestones"
      reference={contract?.reference}
      error={error}
      footer={
        <>
          <button
            type="button"
            onClick={() => navigate(`/contracts/${contractId}/setup/2`)}
            disabled={submitting}
          >
            Back
          </button>
          <button
            type="button"
            className="primary"
            disabled={submitting}
            onClick={() => void handleComplete()}
          >
            {submitting ? "Creating…" : "Create contract"}
          </button>
        </>
      }
    >
      <div className="contract-create-fields">
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
            <h3>Milestones</h3>
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
                        onBlur={() => {
                          if (
                            contract?.category === "time_and_material" &&
                            !milestones.some((item) => item.name.trim())
                          ) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              milestones: "Add at least one milestone for Time & Material.",
                            }));
                          }
                        }}
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
      </div>
    </ContractCreateLayout>
  );
}
