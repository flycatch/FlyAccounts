import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../../api/schema";
import { apiClient } from "../../../api/client";
import { PillToggle } from "../../../components/PillToggle";
import { SelectField } from "../../../components/SelectField";
import { TextareaField } from "../../../components/TextareaField";
import { TextField } from "../../../components/TextField";
import { useEntityContext } from "../../../entity/EntityContext";
import { ContractCreateLayout } from "./ContractCreateLayout";

type MeResponse = components["schemas"]["MeResponse"];
type ContractDetail = components["schemas"]["ContractDetail"];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "support", label: "Support" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type Step2ClosurePageProps = {
  me: MeResponse;
};

export function Step2ClosurePage({ me }: Step2ClosurePageProps) {
  const { contractId = "" } = useParams();
  const navigate = useNavigate();
  const { isAllEntities, entityHeaderValue } = useEntityContext();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [owners, setOwners] = useState<{ id: string; displayName: string }[]>([]);
  const [closureOwnerUserId, setClosureOwnerUserId] = useState(me.id);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectStatus, setProjectStatus] = useState<(typeof STATUSES)[number]["value"]>("active");
  const [pmoNote, setPmoNote] = useState("");
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
        setError("Could not load draft contract.");
        setLoading(false);
        return;
      }
      setContract(detail.data);
      if (ownersRes.response.ok && ownersRes.data) {
        setOwners(ownersRes.data.owners);
      }
      if (detail.data.closureOwnerUserId) {
        setClosureOwnerUserId(detail.data.closureOwnerUserId);
      }
      if (detail.data.startDate) {
        setStartDate(detail.data.startDate);
      }
      if (detail.data.endDate) {
        setEndDate(detail.data.endDate);
      }
      if (detail.data.projectStatus) {
        setProjectStatus(detail.data.projectStatus);
      }
      if (detail.data.pmoNote) {
        setPmoNote(detail.data.pmoNote);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [contractId, entityHeaderValue]);

  function validate(showAll = false): boolean {
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
    if (showAll || Object.keys(fieldErrors).length) {
      setFieldErrors(next);
    }
    return Object.keys(next).length === 0;
  }

  async function handleContinue() {
    if (!validate(true)) {
      setError("Fix the highlighted fields before continuing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const updated = await apiClient.PATCH("/contracts/{contractId}", {
      params: {
        path: { contractId },
        header: { "X-Entity-Id": entityHeaderValue },
      },
      body: {
        closureOwnerUserId,
        startDate,
        endDate,
        projectStatus,
        pmoNote: pmoNote || undefined,
      },
    });
    setSubmitting(false);
    if (!updated.response.ok || !updated.data) {
      const err = updated.error as { message?: string } | undefined;
      setError(err?.message || "Could not save step 2.");
      return;
    }
    navigate(`/contracts/${contractId}/setup/3`);
  }

  if (isAllEntities) {
    return <Navigate to="/contracts" replace />;
  }

  if (loading) {
    return <p>Loading draft…</p>;
  }

  return (
    <ContractCreateLayout
      step={2}
      title="Closure, period & status"
      reference={contract?.reference}
      error={error}
      footer={
        <>
          <button type="button" onClick={() => navigate("/contracts/new")} disabled={submitting}>
            Back
          </button>
          <button
            type="button"
            className="primary"
            disabled={submitting}
            onClick={() => void handleContinue()}
          >
            {submitting ? "Saving…" : "Continue"}
          </button>
        </>
      }
    >
      <div className="contract-create-fields">
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
          {(owners.length ? owners : [{ id: me.id, displayName: `${me.displayName} (you)` }]).map(
            (owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.displayName}
              </option>
            ),
          )}
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
      </div>
    </ContractCreateLayout>
  );
}
