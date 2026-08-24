import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { SelectField } from "../../components/SelectField";
import { TextField } from "../../components/TextField";
import { useEntityContext } from "../../entity/EntityContext";
import { downloadProformaPdf } from "../../proformas/downloadProformaPdf";
import { apiErrorMessage, useToast } from "../../toast/ToastProvider";
import "../../components/settings.css";
import "../contracts/ContractsPage.css";
import { ProformaInvoiceDocument } from "./ProformaInvoiceDocument";
import "./ProformaInvoice.css";
import { useProformaLetterhead } from "./useProformaLetterhead";

type MeResponse = components["schemas"]["MeResponse"];
type ContractSummary = components["schemas"]["ContractSummary"];
type ContractDetail = components["schemas"]["ContractDetail"];
type ProformaStatus = components["schemas"]["CreateProformaRequest"]["status"];

const STATUS_OPTIONS: { value: ProformaStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "shared_with_client", label: "Shared w/ Client" },
  { value: "approved", label: "Approved" },
];

type NewProformaPageProps = {
  me: MeResponse;
};

function estimatedFromContract(contract: ContractDetail | ContractSummary): string {
  if ("projectValue" in contract && contract.paymentType === "project_value" && contract.projectValue) {
    return contract.projectValue;
  }
  if ("monthlyRate" in contract && contract.paymentType === "monthly" && contract.monthlyRate) {
    return contract.monthlyRate;
  }
  if ("projectValue" in contract && contract.projectValue) {
    return contract.projectValue;
  }
  if ("monthlyRate" in contract && contract.monthlyRate) {
    return contract.monthlyRate;
  }
  return "";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewProformaPage({ me }: NewProformaPageProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const lockedContractId = searchParams.get("contractId")?.trim() || "";
  const { isAllEntities, entityHeaderValue, selectedEntity } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const { letterhead } = useProformaLetterhead();

  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [contractId, setContractId] = useState(lockedContractId);
  const [currency, setCurrency] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState<ProformaStatus>("draft");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyContractDetail = useCallback(
    (detail: ContractDetail) => {
      setCurrency(detail.currency);
      setContractReference(detail.reference);
      if (canViewFinancials) {
        setEstimatedAmount(estimatedFromContract(detail));
      }
      setClientName(detail.clientName ?? "");
      setClientAddress(detail.clientAddress ?? "");
      setClientEmail(detail.clientEmail ?? "");
    },
    [canViewFinancials],
  );

  const loadContractDetail = useCallback(
    async (id: string) => {
      if (!id) {
        setCurrency("");
        setEstimatedAmount("");
        setClientName("");
        setClientAddress("");
        setClientEmail("");
        setContractReference("");
        return;
      }
      const { data, response } = await apiClient.GET("/contracts/{contractId}", {
        params: {
          path: { contractId: id },
          header: { "X-Entity-Id": entityHeaderValue },
        },
      });
      if (!response.ok || !data) {
        setError("Could not load contract details.");
        return;
      }
      setError(null);
      applyContractDetail(data);
    },
    [applyContractDetail, entityHeaderValue],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadContracts() {
      setLoadingContracts(true);
      const { data, response } = await apiClient.GET("/contracts", {
        params: {
          query: { status: "all", page: 1, pageSize: 50 },
          header: { "X-Entity-Id": entityHeaderValue },
        },
      });
      if (cancelled) {
        return;
      }
      if (!response.ok || !data) {
        setError("Could not load contracts.");
        setContracts([]);
        setLoadingContracts(false);
        return;
      }
      const rows = data.contracts.filter((row) => !row.isDraft);
      setContracts(rows);
      setLoadingContracts(false);
      if (lockedContractId) {
        setContractId(lockedContractId);
      }
    }
    void loadContracts();
    return () => {
      cancelled = true;
    };
  }, [entityHeaderValue, lockedContractId]);

  useEffect(() => {
    if (!contractId || isAllEntities) {
      return;
    }
    void loadContractDetail(contractId);
  }, [contractId, isAllEntities, loadContractDetail]);

  const invoiceValues = useMemo(
    () => ({
      invoiceDate: todayIso(),
      validUntil,
      contractReference,
      currency,
      estimatedAmount,
      amountRestricted: !canViewFinancials,
      entityName: selectedEntity?.name ?? "",
      clientName,
      clientAddress,
      clientEmail,
    }),
    [
      canViewFinancials,
      clientAddress,
      clientEmail,
      clientName,
      contractReference,
      currency,
      estimatedAmount,
      selectedEntity?.name,
      validUntil,
    ],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isAllEntities) {
      toast.error("Select a single entity to create a proforma.");
      return;
    }
    if (!contractId) {
      toast.error("Select a contract.");
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
    const { data, error: apiError, response } = await apiClient.POST("/proformas", {
      params: { header: { "X-Entity-Id": entityHeaderValue } },
      body: {
        contractId,
        validUntil,
        status,
        ...(canViewFinancials ? { estimatedAmount: estimatedAmount.trim() } : {}),
      },
    });
    setSaving(false);
    if (!response.ok || apiError || !data) {
      toast.error(apiErrorMessage(apiError, "Could not create proforma."));
      return;
    }
    setCreated({ id: data.id, code: data.code });
    toast.success(`Proforma ${data.code} created.`);
  }

  async function handleDownloadCreated() {
    if (!created) {
      return;
    }
    try {
      await downloadProformaPdf(created.id, `${created.code}.pdf`);
      toast.success("Proforma downloaded.");
      navigate("/proformas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download proforma PDF.");
    }
  }

  if (isAllEntities) {
    return (
      <div className="contracts-page">
        <p className="contracts-error">Select a single entity to create a proforma.</p>
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
          <h2>New Proforma</h2>
          <span className="contracts-badge status-support" data-testid="proforma-tax-badge">
            NOT TAX-VALID - FOR APPROVAL ONLY
          </span>
        </div>
        {created ? (
          <div className="proforma-page-actions">
            <button type="button" className="contracts-new-btn" onClick={() => void handleDownloadCreated()}>
              Download
            </button>
            <button type="button" className="settings-secondary" onClick={() => navigate("/proformas")}>
              Back to list
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}

      {created ? (
        <div className="contract-detail-section">
          <p>
            Proforma <strong>{created.code}</strong> was created.
          </p>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <ProformaInvoiceDocument
            letterhead={letterhead}
            values={invoiceValues}
            formControls={
              <>
                <div className="proforma-invoice-form-grid">
                  <SelectField
                    label="Contract"
                    id="proforma-contract"
                    value={contractId}
                    disabled={Boolean(lockedContractId) || loadingContracts}
                    onChange={(event) => setContractId(event.target.value)}
                    required
                  >
                    <option value="">Select contract</option>
                    {contracts.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.reference}
                        {row.clientName ? ` — ${row.clientName}` : ""}
                      </option>
                    ))}
                  </SelectField>
                  <TextField label="Currency" value={currency || "—"} readOnly aria-label="Currency" />
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
                  <button type="submit" className="contracts-new-btn" disabled={saving || !contractId}>
                    {saving ? "Saving…" : "Create Proforma"}
                  </button>
                </div>
              </>
            }
          />
        </form>
      )}
    </div>
  );
}
