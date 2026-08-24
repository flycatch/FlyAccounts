import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { TextField } from "../../components/TextField";
import { useEntityContext } from "../../entity/EntityContext";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
import "../../components/settings.css";
import "../contracts/ContractsPage.css";
import { ProformaInvoiceDocument } from "./ProformaInvoiceDocument";
import "./ProformaInvoice.css";
import { useProformaLetterhead } from "./useProformaLetterhead";

type MeResponse = components["schemas"]["MeResponse"];
type Proforma = components["schemas"]["Proforma"];
type ProformaStatus = components["schemas"]["CreateProformaRequest"]["status"];

const STATUS_OPTIONS: { value: ProformaStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "shared_with_client", label: "Shared w/ Client" },
  { value: "approved", label: "Approved" },
];

type EditProformaPageProps = {
  me: MeResponse;
};

export function EditProformaPage({ me }: EditProformaPageProps) {
  const { proformaId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { entityHeaderValue, isAllEntities } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const { letterhead } = useProformaLetterhead();
  const [proforma, setProforma] = useState<Proforma | null>(null);
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState<ProformaStatus>("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, response } = await apiClient.GET("/proformas/{proformaId}", {
        params: {
          path: { proformaId },
          header: { "X-Entity-Id": entityHeaderValue },
        },
      });
      if (cancelled) {
        return;
      }
      if (!response.ok || !data) {
        setError("Proforma was not found.");
        setProforma(null);
        setLoading(false);
        return;
      }
      setProforma(data);
      setEstimatedAmount(data.estimatedAmount ?? "");
      setValidUntil(data.validUntil);
      setStatus(data.status);
      setError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityHeaderValue, proformaId]);

  const invoiceValues = useMemo(
    () =>
      proforma
        ? {
            code: proforma.code,
            invoiceDate: proforma.createdAt,
            validUntil,
            contractReference: proforma.contractReference,
            currency: proforma.currency,
            estimatedAmount,
            amountRestricted: !canViewFinancials,
            entityName: proforma.entityName,
            clientName: proforma.clientName,
            clientAddress: proforma.clientAddress ?? "",
            clientEmail: proforma.clientEmail ?? "",
          }
        : null,
    [canViewFinancials, estimatedAmount, proforma, validUntil],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isAllEntities) {
      toast.error("Select a single entity to edit a proforma.");
      return;
    }
    if (!validUntil) {
      toast.error("Valid until is required.");
      return;
    }
    if (canViewFinancials && !estimatedAmount.trim()) {
      toast.error("Estimated amount is required.");
      return;
    }
    setSaving(true);
    const { data, error: apiError, response } = await apiClient.PATCH("/proformas/{proformaId}", {
      params: {
        path: { proformaId },
        header: { "X-Entity-Id": entityHeaderValue },
      },
      body: {
        validUntil,
        status,
        ...(canViewFinancials ? { estimatedAmount: estimatedAmount.trim() } : {}),
      },
    });
    setSaving(false);
    if (!response.ok || apiError || !data) {
      toast.error(apiErrorMessage(apiError, "Could not update proforma."));
      return;
    }
    toast.success(`Proforma ${data.code} updated.`);
    navigate(`/proformas/${data.id}`);
  }

  if (isAllEntities) {
    return (
      <div className="contracts-page">
        <p className="contracts-error">Select a single entity to edit a proforma.</p>
        <Link to="/proformas">← Back to proformas</Link>
      </div>
    );
  }

  return (
    <div className="proforma-page">
      <div className="proforma-page-chrome">
        <div className="proforma-page-chrome-left">
          <Link to="/proformas" className="contract-create-back">
            ← Proformas
          </Link>
          <h2>Edit {proforma?.code ?? "Proforma"}</h2>
          <span className="contracts-badge status-support" data-testid="proforma-tax-badge">
            NOT TAX-VALID - FOR APPROVAL ONLY
          </span>
        </div>
      </div>

      {loading ? <p>Loading proforma…</p> : null}
      {error ? <p className="contracts-error">{error}</p> : null}

      {!loading && !error && proforma && invoiceValues ? (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <ProformaInvoiceDocument
            letterhead={letterhead}
            values={invoiceValues}
            formControls={
              <>
                <div className="proforma-invoice-form-grid">
                  <TextField label="Contract" value={proforma.contractReference} readOnly />
                  <TextField label="Currency" value={proforma.currency} readOnly />
                  {canViewFinancials ? (
                    <TextField
                      label="Estimated Amount"
                      id="proforma-amount"
                      value={estimatedAmount}
                      onChange={(event) => setEstimatedAmount(event.target.value)}
                      required
                    />
                  ) : null}
                  <TextField
                    label="Valid Until"
                    id="proforma-valid-until"
                    type="date"
                    lang="en-GB"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <p className="proforma-invoice-section-title">Status</p>
                  <div className="contracts-status-pills" role="radiogroup" aria-label="Proforma status">
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={status === option.value}
                        className={`contracts-status-pill${status === option.value ? " is-active" : ""}`}
                        onClick={() => setStatus(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="proforma-page-actions">
                  <button type="button" className="settings-secondary" onClick={() => navigate(`/proformas/${proformaId}`)}>
                    Cancel
                  </button>
                  <button type="submit" className="contracts-new-btn" disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </>
            }
          />
        </form>
      ) : null}
    </div>
  );
}
