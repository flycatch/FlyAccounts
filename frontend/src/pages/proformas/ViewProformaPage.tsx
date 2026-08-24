import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { useEntityContext } from "../../entity/EntityContext";
import { downloadProformaPdf } from "../../proformas/downloadProformaPdf";
import { useToast } from "../../toast/ToastProvider";
import "../../components/settings.css";
import "../contracts/ContractsPage.css";
import { ProformaInvoiceDocument } from "./ProformaInvoiceDocument";
import "./ProformaInvoice.css";
import { useProformaLetterhead } from "./useProformaLetterhead";

type MeResponse = components["schemas"]["MeResponse"];
type Proforma = components["schemas"]["Proforma"];

type ViewProformaPageProps = {
  me: MeResponse;
};

export function ViewProformaPage({ me }: ViewProformaPageProps) {
  const { proformaId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { entityHeaderValue, isAllEntities } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const { letterhead } = useProformaLetterhead();
  const [proforma, setProforma] = useState<Proforma | null>(null);
  const [loading, setLoading] = useState(true);
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
      setError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entityHeaderValue, proformaId]);

  async function handleDownload() {
    if (!proforma) {
      return;
    }
    try {
      await downloadProformaPdf(proforma.id, `${proforma.code}.pdf`);
      toast.success("Proforma downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download proforma PDF.");
    }
  }

  return (
    <div className="proforma-page">
      <div className="proforma-page-chrome">
        <div className="proforma-page-chrome-left">
          <Link to="/proformas" className="contract-create-back">
            ← Proformas
          </Link>
          <h2>{proforma?.code ?? "Proforma"}</h2>
          <span className="contracts-badge status-support" data-testid="proforma-tax-badge">
            NOT TAX-VALID - FOR APPROVAL ONLY
          </span>
        </div>
        <div className="proforma-page-actions">
          <button
            type="button"
            className="settings-secondary"
            disabled={isAllEntities || !proforma}
            title={isAllEntities ? "Select a single entity to edit" : undefined}
            onClick={() => navigate(`/proformas/${proformaId}/edit`)}
          >
            Edit
          </button>
          <button type="button" className="contracts-new-btn" disabled={!proforma} onClick={() => void handleDownload()}>
            Download
          </button>
        </div>
      </div>

      {loading ? <p>Loading proforma…</p> : null}
      {error ? <p className="contracts-error">{error}</p> : null}

      {!loading && !error && proforma ? (
        <ProformaInvoiceDocument
          letterhead={letterhead}
          values={{
            code: proforma.code,
            invoiceDate: proforma.createdAt,
            validUntil: proforma.validUntil,
            contractReference: proforma.contractReference,
            currency: proforma.currency,
            estimatedAmount: proforma.estimatedAmount ?? "",
            amountRestricted: !canViewFinancials,
            entityName: proforma.entityName,
            clientName: proforma.clientName,
            clientAddress: proforma.clientAddress ?? "",
            clientEmail: proforma.clientEmail ?? "",
          }}
        />
      ) : null}
    </div>
  );
}
