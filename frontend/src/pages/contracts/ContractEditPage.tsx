import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { PillToggle } from "../../components/PillToggle";
import { SearchableSelect } from "../../components/SearchableSelect";
import { SelectField } from "../../components/SelectField";
import { TextareaField } from "../../components/TextareaField";
import { TextField } from "../../components/TextField";
import { useEntityContext } from "../../entity/EntityContext";
import { MilestonesTable, type MilestoneDraft } from "./MilestonesTable";
import "./ContractsPage.css";
import "./create/ContractCreate.css";

type MeResponse = components["schemas"]["MeResponse"];
type ContractDetail = components["schemas"]["ContractDetail"];
type Client = components["schemas"]["Client"];

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
  const canLookupClients = me.permissions.includes("manage_clients");
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [owners, setOwners] = useState<{ id: string; displayName: string }[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [closureOwnerUserId, setClosureOwnerUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectStatus, setProjectStatus] = useState<(typeof STATUSES)[number]["value"]>("active");
  const [pmoNote, setPmoNote] = useState("");
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

      setClientId(data.clientId ?? "");
      if (data.clientId && data.clientName) {
        setClients([
          {
            id: data.clientId,
            name: data.clientName,
            address: "",
            contactPerson: "",
            contactEmail: "",
            contactPhone: "",
            vatNumber: "",
            createdAt: data.createdAt,
          },
        ]);
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
      setMonths(data.months ? String(data.months) : "");
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
  }, [contractId, entityHeaderValue, me.id]);

  useEffect(() => {
    if (!canLookupClients) {
      return;
    }
    let cancelled = false;
    async function loadClients(search = "") {
      const { data, response } = await apiClient.GET("/clients", {
        params: {
          query: {
            pageSize: 50,
            page: 1,
            search: search.trim() || undefined,
          },
        },
      });
      if (cancelled || !response.ok || !data) {
        return;
      }
      setClients((prev) => {
        const selected = prev.find((item) => item.id === clientId);
        const merged = [...data.clients];
        if (selected && !merged.some((item) => item.id === selected.id)) {
          merged.unshift(selected);
        }
        return merged;
      });
    }
    const handle = window.setTimeout(() => {
      void loadClients(clientSearch);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [canLookupClients, clientSearch, clientId]);

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

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!clientId) {
      next.client =
        canLookupClients
          ? "Select a client."
          : "Client lookup requires manage_clients permission.";
    }
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
          next.monthlyRate = "Monthly payment amount is required.";
        }
        if (!months.trim() || Number.parseInt(months, 10) < 1) {
          next.months = "Months is required.";
        }
      }
    }
    if (isTimeAndMaterial) {
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
      clientId,
      closureOwnerUserId,
      startDate,
      endDate,
      projectStatus,
      pmoNote: pmoNote || undefined,
      paymentType,
      milestones: isTimeAndMaterial
        ? milestones
            .filter((item) => item.name.trim())
            .map((item, index) => ({
              name: item.name.trim(),
              value: canViewFinancials ? item.value || "0" : "0",
              dueConditionOrDate: item.dueConditionOrDate || startDate,
              sortOrder: index,
            }))
        : [],
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
          {contract.isAmendment && contract.parentContractReference
            ? ` · Parent ${contract.parentContractReference}`
            : ""}
        </p>
        <div className="contract-create-fields">
          <SearchableSelect
            label="Client"
            value={clientId}
            error={fieldErrors.client}
            disabled={!canLookupClients}
            placeholder={canLookupClients ? "Search clients" : "Client lookup unavailable"}
            options={clients.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={(next) => {
              setClientId(next);
              setFieldErrors((prev) => ({ ...prev, client: "" }));
            }}
            onSearchChange={setClientSearch}
            onBlur={() => {
              if (!clientId) {
                setFieldErrors((prev) => ({
                  ...prev,
                  client: canLookupClients
                    ? "Select a client."
                    : "Client lookup requires manage_clients permission.",
                }));
              }
            }}
          />
          {!canLookupClients ? (
            <p className="contract-hint">
              Client lookup requires the manage_clients permission.
            </p>
          ) : null}
        </div>
      </section>

      <section className="contract-detail-section contract-create-fields">
        <h3>Closure</h3>
        <SelectField
          label="Closure Owner"
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
          label="Contract Period Start Date"
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
          label="Contract Period End Date"
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
          label="Project Status"
          value={projectStatus}
          options={STATUSES}
          onChange={setProjectStatus}
        />
        <TextareaField
          label="PMO Note"
          value={pmoNote}
          onChange={(event) => setPmoNote(event.target.value)}
          rows={3}
        />
      </section>

      <section className="contract-detail-section contract-create-fields">
        <h3>Payment & milestones</h3>
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
          />
        ) : null}
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
