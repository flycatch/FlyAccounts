import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";
import { IconButton } from "../../components/IconButton";
import editIcon from "../../assets/icons/edit.svg";
import { PaginationBar } from "../../components/PaginationBar";
import { useEntityContext } from "../../entity/EntityContext";
import { useListQueryParams } from "../../hooks/useListQueryParams";
import { downloadProformaPdf } from "../../proformas/downloadProformaPdf";
import { useToast } from "../../toast/ToastProvider";
import "../contracts/ContractsPage.css";

type Proforma = components["schemas"]["Proforma"];
type MeResponse = components["schemas"]["MeResponse"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  shared_with_client: "Shared w/ Client",
  approved: "Approved",
};

type ProformasPageProps = {
  me: MeResponse;
};

function formatValidUntil(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) {
    return iso;
  }
  return `${day}/${month}/${year}`;
}

const ViewIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const DownloadIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ConvertIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block" }}
  >
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export function ProformasPage({ me }: ProformasPageProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { selectedEntity, isAllEntities, entityHeaderValue } = useEntityContext();
  const canViewFinancials = me.permissions.includes("view_contract_financials");
  const { search, searchInput, setSearchInput, page, pageSize, setPage, setPageSize } =
    useListQueryParams();
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const contextLabel = isAllEntities ? "All Entities" : selectedEntity?.name ?? "Entity";

  const loadProformas = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError, response } = await apiClient.GET("/proformas", {
      params: {
        query: {
          search: search.trim() || undefined,
          page,
          pageSize,
        },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    if (!response.ok || apiError || !data) {
      setError("Could not load proformas.");
      setProformas([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setProformas(data.proformas);
    setTotal(data.total);
    setLoading(false);
  }, [entityHeaderValue, page, pageSize, search]);

  useEffect(() => {
    void loadProformas();
  }, [loadProformas]);

  async function handleDownload(row: Proforma) {
    try {
      await downloadProformaPdf(row.id, `${row.code}.pdf`);
      toast.success("Proforma downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not download proforma PDF.");
    }
  }

  const colSpan = canViewFinancials ? 9 : 8;

  return (
    <div className="contracts-page">
      <div className="contracts-toolbar">
        <div className="contracts-toolbar-left">
          <span className="contracts-entity-pill" data-testid="entity-pill">
            {contextLabel}
          </span>
          <input
            className="contracts-search"
            type="search"
            placeholder="Search proforma ID, contract, or client"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Search proformas"
          />
        </div>
        <button
          type="button"
          className="contracts-new-btn"
          disabled={isAllEntities}
          title={isAllEntities ? "Select a single entity to create a proforma" : undefined}
          onClick={() => navigate("/proformas/new")}
        >
          + New Proforma
        </button>
      </div>

      {error ? <p className="contracts-error">{error}</p> : null}
      {loading ? <p>Loading proformas…</p> : null}

      {!loading && !error ? (
        <>
          <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr>
                  <th>Proforma ID</th>
                  <th>Contract Ref</th>
                  <th>Client Name</th>
                  <th>Entity</th>
                  {canViewFinancials ? <th>Amount</th> : null}
                  <th>Currency</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {proformas.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan}>
                      {search.trim() ? "No proformas match this view." : "No proformas yet."}
                    </td>
                  </tr>
                ) : (
                  proformas.map((row) => {
                    const approved = row.status === "approved";
                    return (
                      <tr key={row.id}>
                        <td>{row.code}</td>
                        <td>{row.contractReference}</td>
                        <td>{row.clientName}</td>
                        <td>{row.entityName}</td>
                        {canViewFinancials ? <td>{row.estimatedAmount ?? "—"}</td> : null}
                        <td>{row.currency}</td>
                        <td>{formatValidUntil(row.validUntil)}</td>
                        <td>
                          <span
                            className={`contracts-badge status-${
                              row.status === "approved" ? "active" : "support"
                            }`}
                          >
                            {STATUS_LABELS[row.status] ?? row.status}
                          </span>
                        </td>
                        <td className="contracts-actions">
                          <IconButton
                            label="View proforma"
                            icon={ViewIcon}
                            onClick={() => navigate(`/proformas/${row.id}`)}
                          />
                          <IconButton
                            label="Edit proforma"
                            icon={<img src={editIcon} alt="" />}
                            disabled={isAllEntities}
                            title={
                              isAllEntities
                                ? "Select a single entity to edit a proforma"
                                : undefined
                            }
                            onClick={() => navigate(`/proformas/${row.id}/edit`)}
                          />
                          <IconButton
                            label="Download"
                            icon={DownloadIcon}
                            onClick={() => void handleDownload(row)}
                          />
                          <IconButton
                            label="Convert to Tax Invoice"
                            icon={ConvertIcon}
                            disabled={!approved}
                            title={
                              approved
                                ? "Convert to tax invoice"
                                : "Available only when status is Approved"
                            }
                            onClick={() => {
                              if (!approved) {
                                return;
                              }
                              toast.success("Coming soon");
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      ) : null}
    </div>
  );
}
