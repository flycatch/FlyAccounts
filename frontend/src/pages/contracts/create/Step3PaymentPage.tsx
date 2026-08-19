import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../../api/schema";
import { apiClient } from "../../../api/client";
import { PillToggle } from "../../../components/PillToggle";
import { TextField } from "../../../components/TextField";
import { useEntityContext } from "../../../entity/EntityContext";
import { MilestonesTable, type MilestoneDraft } from "../MilestonesTable";
import { ContractCreateLayout } from "./ContractCreateLayout";

type MeResponse = components["schemas"]["MeResponse"];
type ContractDetail = components["schemas"]["ContractDetail"];

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
  const [months, setMonths] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTimeAndMaterial = contract?.category === "time_and_material";

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
      if (data.category === "time_and_material" && data.milestones && data.milestones.length > 0) {
        setMilestones(
          data.milestones.map((item) => ({
            name: item.name,
            value: item.value,
            dueConditionOrDate: item.dueConditionOrDate,
          })),
        );
      } else {
        setMilestones([]);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [contractId, entityHeaderValue]);

  function handlePaymentTypeChange(next: "project_value" | "monthly") {
    setPaymentType(next);
    if (next === "project_value") {
      setMonthlyRate("");
      setMonths("");
      setFieldErrors((prev) => ({ ...prev, monthlyRate: "", months: "" }));
    } else {
      setProjectValue("");
      setFieldErrors((prev) => ({ ...prev, projectValue: "" }));
    }
  }

  function validate(showAll = false): boolean {
    const next: Record<string, string> = {};
    if (canViewFinancials) {
      if (paymentType === "project_value" && !projectValue.trim()) {
        next.projectValue = "Project value is required.";
      }
      if (paymentType === "monthly") {
        if (!monthlyRate.trim()) {
          next.monthlyRate = "Monthly payment amount is required.";
        }
        if (!months.trim() || Number.parseInt(months, 10) < 1) {
          next.months = "Months is required.";
        }
      }
    }
    if (isTimeAndMaterial) {
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
      milestones: isTimeAndMaterial
        ? milestones
            .filter((item) => item.name.trim())
            .map((item, index) => ({
              name: item.name.trim(),
              value: canViewFinancials ? item.value || "0" : "0",
              dueConditionOrDate: item.dueConditionOrDate || contract?.startDate || "",
              sortOrder: index,
            }))
        : [],
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
          label="Payment Type"
          value={paymentType}
          options={[
            { value: "project_value", label: "Project Value" },
            { value: "monthly", label: "Monthly × Months" },
          ]}
          onChange={handlePaymentTypeChange}
        />

        {canViewFinancials ? (
          paymentType === "project_value" ? (
            <TextField
              label="Total project value"
              type="number"
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
                label="Monthly Payment Amount"
                type="number"
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
                      monthlyRate: "Monthly payment amount is required.",
                    }));
                  }
                }}
              />
              <TextField
                label="Months"
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
                      months: "Months is required.",
                    }));
                  }
                }}
              />
            </>
          )
        ) : (
          <p className="contract-hint">Payment amounts are hidden for your role.</p>
        )}

        {isTimeAndMaterial ? (
          <MilestonesTable
            milestones={milestones}
            canViewFinancials={canViewFinancials}
            error={fieldErrors.milestones}
            onChange={(rows) => {
              setMilestones(rows);
              setFieldErrors((prev) => ({ ...prev, milestones: "" }));
            }}
            onBlurValidate={() => {
              if (!milestones.some((item) => item.name.trim())) {
                setFieldErrors((prev) => ({
                  ...prev,
                  milestones: "Add at least one milestone for Time & Material.",
                }));
              }
            }}
          />
        ) : null}
      </div>
    </ContractCreateLayout>
  );
}
