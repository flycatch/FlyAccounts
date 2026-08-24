import type { ReactNode } from "react";

import type { components } from "../../api/schema";
import brandLogo from "../../assets/icons/flycatch-brand.png";
import "./ProformaInvoice.css";

export type ProformaLetterhead = components["schemas"]["ProformaLetterhead"];

export type ProformaInvoiceValues = {
  code?: string;
  invoiceDate?: string;
  validUntil: string;
  contractReference: string;
  currency: string;
  estimatedAmount: string;
  amountRestricted?: boolean;
  entityName: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
};

type ProformaInvoiceDocumentProps = {
  letterhead: ProformaLetterhead | null;
  values: ProformaInvoiceValues;
  /** Editable fields rendered inside the meta / form areas */
  metaControls?: ReactNode;
  formControls?: ReactNode;
};

function formatDisplayDate(iso?: string): string {
  if (!iso) {
    return "";
  }
  if (iso.includes("T")) {
    const day = iso.slice(0, 10);
    const [year, month, d] = day.split("-");
    if (year && month && d) {
      return `${d}/${month}/${year}`;
    }
    return day;
  }
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}/${month}/${year}`;
}

function companyLines(entityName: string, letterhead: ProformaLetterhead | null): string[] {
  if (!letterhead) {
    return entityName ? [entityName] : [];
  }
  const locality = [letterhead.companyCity, letterhead.companyState, letterhead.companyPostalCode]
    .filter(Boolean)
    .join(", ");
  return [
    entityName,
    letterhead.companyAddressLine1,
    letterhead.companyAddressLine2,
    locality,
    letterhead.companyCountry,
    letterhead.companyPhone,
    letterhead.companyEmail,
  ].filter(Boolean);
}

export function ProformaInvoiceDocument({
  letterhead,
  values,
  metaControls,
  formControls,
}: ProformaInvoiceDocumentProps) {
  const amountLabel = values.amountRestricted
    ? "Restricted"
    : values.estimatedAmount.trim() || "—";
  const currency = values.currency || "";
  const description = values.contractReference
    ? `Services — ${values.contractReference}`
    : "Services";

  return (
    <article className="proforma-invoice" data-testid="proforma-invoice-document">
      <div className="proforma-invoice-header">
        <div>
          <div className="proforma-invoice-brand">
            <img className="proforma-invoice-logo" src={brandLogo} alt="" />
            <p className="proforma-invoice-brand-name">{values.entityName || "—"}</p>
          </div>
          <h3 className="proforma-invoice-section-title">Company Information</h3>
          <ul className="proforma-invoice-company-lines">
            {companyLines(values.entityName, letterhead).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="proforma-invoice-client-box">
          <h3 className="proforma-invoice-section-title">Client</h3>
          <ul className="proforma-invoice-client-lines">
            {values.clientName ? <li>{values.clientName}</li> : <li>—</li>}
            {values.clientAddress ? <li>{values.clientAddress}</li> : null}
            {values.clientEmail ? <li>{values.clientEmail}</li> : null}
          </ul>
        </div>
      </div>

      <hr className="proforma-invoice-divider" />
      <h2 className="proforma-invoice-title">Proforma Invoice</h2>

      {metaControls ? (
        metaControls
      ) : (
        <dl className="proforma-invoice-meta">
          <div className="proforma-invoice-meta-row">
            <dt>Invoice Number</dt>
            <dd>{values.code || "Assigned on save"}</dd>
          </div>
          <div className="proforma-invoice-meta-row">
            <dt>Invoice Date</dt>
            <dd>{formatDisplayDate(values.invoiceDate) || "—"}</dd>
          </div>
          <div className="proforma-invoice-meta-row">
            <dt>Valid Until</dt>
            <dd>{formatDisplayDate(values.validUntil) || "—"}</dd>
          </div>
          <div className="proforma-invoice-meta-row">
            <dt>Project / Reference</dt>
            <dd>{values.contractReference || "—"}</dd>
          </div>
        </dl>
      )}

      <div className="proforma-invoice-table-wrap">
        <table className="proforma-invoice-table" aria-label="Proforma line items">
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Item Description</th>
              <th scope="col">Quantity</th>
              <th scope="col">{`Unit Price (${currency || "Currency"})`}</th>
              <th scope="col">{`Amount (${currency || "Currency"})`}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td className="proforma-desc">{description}</td>
              <td>1</td>
              <td>{amountLabel}</td>
              <td>{amountLabel}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="proforma-invoice-totals" aria-label="Proforma totals">
        <tbody>
          <tr>
            <th scope="row">Subtotal</th>
            <td>{amountLabel}</td>
          </tr>
          <tr>
            <th scope="row">Total</th>
            <td>{amountLabel}</td>
          </tr>
          <tr className="is-strong">
            <th scope="row">Total Amount</th>
            <td>{amountLabel}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="proforma-invoice-account-title">Account Details</h3>
      <dl className="proforma-invoice-account">
        <div className="proforma-invoice-account-row">
          <dt>Account Name</dt>
          <dd>{letterhead?.accountName || "—"}</dd>
        </div>
        <div className="proforma-invoice-account-row">
          <dt>Account Number</dt>
          <dd>{letterhead?.accountNumber || "—"}</dd>
        </div>
        <div className="proforma-invoice-account-row">
          <dt>IBAN</dt>
          <dd>{letterhead?.iban || "—"}</dd>
        </div>
        <div className="proforma-invoice-account-row">
          <dt>Bank Name</dt>
          <dd>{letterhead?.bankName || "—"}</dd>
        </div>
        <div className="proforma-invoice-account-row">
          <dt>Bank Address</dt>
          <dd>{letterhead?.bankAddress || "—"}</dd>
        </div>
      </dl>

      {formControls ? <div className="proforma-invoice-form-block">{formControls}</div> : null}
    </article>
  );
}
