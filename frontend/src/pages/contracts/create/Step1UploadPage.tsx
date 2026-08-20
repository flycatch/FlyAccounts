import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import type { components } from "../../../api/schema";
import { apiClient } from "../../../api/client";
import { getAccessToken } from "../../../auth/tokens";
import { PillToggle } from "../../../components/PillToggle";
import { SearchableSelect } from "../../../components/SearchableSelect";
import { SelectField } from "../../../components/SelectField";
import { useEntityContext } from "../../../entity/EntityContext";
import { ContractCreateLayout } from "./ContractCreateLayout";

type MeResponse = components["schemas"]["MeResponse"];
type ContractSummary = components["schemas"]["ContractSummary"];
type ContractDetail = components["schemas"]["ContractDetail"];

const CATEGORIES = [
  { value: "time_and_material", label: "Time & Material" },
  { value: "data_management", label: "Data Management" },
  { value: "contract_staffing", label: "Contract Staffing" },
] as const;

const ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKindOf(file: File): "pdf" | "doc" | "docx" | "other" {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf") || file.type === "application/pdf") {
    return "pdf";
  }
  if (lower.endsWith(".docx")) {
    return "docx";
  }
  if (lower.endsWith(".doc") || file.type === "application/msword") {
    return "doc";
  }
  return "other";
}

function isAllowedFile(file: File): boolean {
  return fileKindOf(file) !== "other";
}

type Step1UploadPageProps = {
  me: MeResponse;
};

export function Step1UploadPage({ me: _me }: Step1UploadPageProps) {
  const navigate = useNavigate();
  const { contractId = "" } = useParams();
  const { isAllEntities, selectedEntity, entityHeaderValue } = useEntityContext();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isAmendment, setIsAmendment] = useState(false);
  const [parentContractId, setParentContractId] = useState("");
  const [parentError, setParentError] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [existingFileMeta, setExistingFileMeta] = useState<{ name: string; key: string } | null>(null);
  const [contract, setContract] = useState<ContractDetail | null>(null);

  const [existingContracts, setExistingContracts] = useState<ContractSummary[]>([]);
  const [parentSearch, setParentSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("time_and_material");
  const [currency, setCurrency] = useState<string>(selectedEntity?.allowedCurrencies[0] ?? "USD");
  const [currencyError, setCurrencyError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!contractId && selectedEntity?.allowedCurrencies && selectedEntity.allowedCurrencies.length > 0) {
      setCurrency(selectedEntity.allowedCurrencies[0]);
    }
  }, [selectedEntity, contractId]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      if (typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);

  const currencies = selectedEntity?.allowedCurrencies ?? [];
  const fileKind = useMemo(() => (file ? fileKindOf(file) : null), [file]);

  const chooseFile = useCallback((next: File | null) => {
    if (!next) {
      setFile(null);
      setFileError(undefined);
      return;
    }
    if (!isAllowedFile(next)) {
      setFileError("Upload a contract document (.pdf, .doc, or .docx).");
      return;
    }
    setFile(next);
    setFileError(undefined);
  }, []);

  async function loadParents(search = "") {
    const { data, response } = await apiClient.GET("/contracts", {
      params: {
        query: {
          status: "all",
          pageSize: 50,
          search: search.trim() || undefined,
        },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    if (response.ok && data) {
      setExistingContracts(data.contracts.filter((item) => !item.isDraft));
    }
  }

  useEffect(() => {
    if (!contractId) {
      return;
    }
    let cancelled = false;
    async function loadDraft() {
      const { data, response } = await apiClient.GET("/contracts/{contractId}", {
        params: {
          path: { contractId },
          header: { "X-Entity-Id": entityHeaderValue },
        },
      });
      if (cancelled) {
        return;
      }
      if (response.ok && data) {
        setContract(data);
        setIsAmendment(data.isAmendment);
        if (data.parentContractId) {
          setParentContractId(data.parentContractId);
        }
        if (data.category) {
          setCategory(data.category as any);
        }
        if (data.currency) {
          setCurrency(data.currency);
        }
        if (data.clientFileKey) {
          setExistingFileMeta({
            name: data.clientFileName || "Uploaded Document",
            key: data.clientFileKey,
          });
        }
      }
    }
    void loadDraft();
    return () => {
      cancelled = true;
    };
  }, [contractId, entityHeaderValue]);

  useEffect(() => {
    if (!isAmendment) {
      return;
    }
    const handle = window.setTimeout(() => {
      void loadParents(parentSearch);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [isAmendment, parentSearch, entityHeaderValue]);

  function validate(showAll = false): boolean {
    let ok = true;

    if (!file && !existingFileMeta) {
      if (showAll) {
        setFileError("Upload a contract document (.pdf, .doc, or .docx).");
      }
      ok = false;
    } else {
      setFileError(undefined);
    }
    if (isAmendment && !parentContractId) {
      if (showAll) {
        setParentError("Select the parent contract for this amendment.");
      }
      ok = false;
    } else {
      setParentError(undefined);
    }
    if (!currency) {
      if (showAll) {
        setCurrencyError("Currency is required.");
      }
      ok = false;
    } else {
      setCurrencyError(undefined);
    }
    return ok;
  }

  async function handleContinue() {
    if (submitLock.current || submitting) {
      return;
    }
    if (!validate(true)) {
      setError("Fix the highlighted fields before continuing.");
      return;
    }
    if (!file && !existingFileMeta) {
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    try {
      let fileKey = existingFileMeta?.key ?? "";
      let fileName = existingFileMeta?.name ?? "";
      let fileContentType = contract?.clientFileContentType ?? "";
      let fileSize = contract?.clientFileSizeBytes ?? 0;

      if (file) {
        const form = new FormData();
        form.append("file", file);
        const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1";
        const uploadResponse = await fetch(`${baseUrl}/contracts/files`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getAccessToken() ?? ""}`,
            "X-Entity-Id": entityHeaderValue,
          },
          body: form,
        });
        if (!uploadResponse.ok) {
          setError("File upload failed.");
          return;
        }
        const uploadData = (await uploadResponse.json()) as {
          fileKey: string;
          fileName: string;
          contentType: string;
          sizeBytes: number;
        };
        fileKey = uploadData.fileKey;
        fileName = uploadData.fileName;
        fileContentType = uploadData.contentType;
        fileSize = uploadData.sizeBytes;
      }

      if (contractId) {
        const updated = await apiClient.PATCH("/contracts/{contractId}", {
          params: {
            path: { contractId },
            header: { "X-Entity-Id": entityHeaderValue },
          },
          body: {
            category,
            currency: currency as any,
            clientFileKey: fileKey,
            clientFileName: fileName,
            clientFileContentType: fileContentType,
            clientFileSizeBytes: fileSize,
            isAmendment,
            parentContractId: isAmendment ? parentContractId : null,
          },
        });
        if (!updated.response.ok) {
          const err = updated.error as { message?: string } | undefined;
          setError(err?.message || "Could not update draft contract.");
          return;
        }
        navigate(`/contracts/${contractId}/setup/2`, { replace: true });
      } else {
        const created = await apiClient.POST("/contracts", {
          body: {
            clientFileKey: fileKey,
            clientFileName: fileName,
            clientFileContentType: fileContentType,
            clientFileSizeBytes: fileSize,
            isAmendment,
            parentContractId: isAmendment ? parentContractId : undefined,
            category,
            currency: currency as any,
          },
          params: { header: { "X-Entity-Id": entityHeaderValue } },
        });
        if (!created.response.ok || !created.data) {
          const err = created.error as { message?: string } | undefined;
          setError(err?.message || "Could not create draft contract.");
          return;
        }
        navigate(`/contracts/${created.data.id}/setup/2`, { replace: true });
      }
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (isAllEntities || !selectedEntity) {
    return <Navigate to="/contracts" replace />;
  }

  return (
    <ContractCreateLayout
      step={1}
      title="Upload contract & category"
      error={error}
      footer={
        <>
          <button type="button" onClick={() => navigate("/contracts")} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={submitting}
            onClick={() => void handleContinue()}
          >
            {submitting ? "Creating…" : "Continue"}
          </button>
        </>
      }
    >
      <div className="contract-create-fields">


        <div
          className={`contract-file-drop${dragging ? " is-dragging" : ""}${fileError ? " is-invalid" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            chooseFile(event.dataTransfer.files?.[0] ?? null);
          }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Upload contract document"
        >
          <p>
            <strong>Contract Document</strong>
          </p>
          <p>Drag and drop a file here, or click to browse (.pdf, .doc, .docx)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            aria-label="Contract Document"
            hidden
            onChange={(event) => {
              chooseFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
            onBlur={() => {
              if (!file && !existingFileMeta) {
                setFileError("Upload a contract document (.pdf, .doc, or .docx).");
              }
            }}
          />
          {fileError ? <span className="ui-field-error">{fileError}</span> : null}
        </div>

        {file || existingFileMeta ? (
          <div className="contract-file-preview" data-testid="file-preview">
            <div className="contract-file-meta">
              <strong>{file ? file.name : (existingFileMeta?.name ?? "Uploaded Document")}</strong>
              <span>
                {file
                  ? (fileKind ?? "file").toUpperCase()
                  : (existingFileMeta?.name.toLowerCase().endsWith(".pdf") ? "PDF" : "Document")}{" "}
                {file && ` · ${formatBytes(file.size)}`}
                {!file && contract?.clientFileSizeBytes ? ` · ${formatBytes(contract.clientFileSizeBytes)}` : ""}
              </span>
            </div>
            <div className="contract-file-actions">
              {file && previewUrl && (fileKind === "docx" || fileKind === "doc" || fileKind === "pdf") ? (
                <a href={previewUrl} download={file.name}>
                  Download
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  chooseFile(null);
                  setExistingFileMeta(null);
                }}
              >
                Remove
              </button>
            </div>
            {file && previewUrl && fileKind === "pdf" ? (
              <iframe title="PDF preview" className="contract-file-frame" src={previewUrl} />
            ) : (
              <p className="contract-hint">
                {file && (fileKind === "docx" || fileKind === "doc")
                  ? "Word preview is not available inline. Use Download to open the file."
                  : "Preview unavailable for uploaded draft contract document."}
              </p>
            )}
          </div>
        ) : null}

        <label className="ui-field contract-amendment-toggle">
          <span>Add Amendment to Existing Contract</span>
          <input
            type="checkbox"
            checked={isAmendment}
            aria-label="Add Amendment to Existing Contract"
            onChange={(event) => {
              const enabled = event.target.checked;
              setIsAmendment(enabled);
              if (!enabled) {
                setParentContractId("");
                setParentError(undefined);
                setParentSearch("");
              } else {
                void loadParents("");
              }
            }}
          />
        </label>

        {isAmendment ? (
          <SearchableSelect
            label="Parent Contract"
            value={parentContractId}
            error={parentError}
            placeholder="Search by Parent Contract Number"
            options={existingContracts.map((item) => ({
              value: item.id,
              label: item.reference,
            }))}
            onChange={(next) => {
              setParentContractId(next);
              setParentError(undefined);
            }}
            onSearchChange={setParentSearch}
            onBlur={() => {
              if (!parentContractId) {
                setParentError("Select the parent contract for this amendment.");
              }
            }}
          />
        ) : (
          <p className="contract-hint">Contract reference will be generated automatically on continue.</p>
        )}

        <PillToggle label="Category" value={category} options={CATEGORIES} onChange={setCategory} />

        <SelectField
          label="Currency"
          value={currency}
          error={currencyError}
          onChange={(event) => {
            setCurrency(event.target.value);
            setCurrencyError(undefined);
          }}
          onBlur={() => {
            if (!currency) {
              setCurrencyError("Currency is required.");
            }
          }}
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </SelectField>
      </div>
    </ContractCreateLayout>
  );
}
