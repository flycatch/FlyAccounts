import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import type { components } from "../../../api/schema";
import { apiClient } from "../../../api/client";
import { getAccessToken } from "../../../auth/tokens";
import { PillToggle } from "../../../components/PillToggle";
import { SelectField } from "../../../components/SelectField";
import { useEntityContext } from "../../../entity/EntityContext";
import { ContractCreateLayout } from "./ContractCreateLayout";

type MeResponse = components["schemas"]["MeResponse"];
type ContractSummary = components["schemas"]["ContractSummary"];

const CATEGORIES = [
  { value: "time_and_material", label: "Time & Material" },
  { value: "data_management", label: "Data Management" },
  { value: "contract_staffing", label: "Contract Staffing" },
] as const;

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type Step1UploadPageProps = {
  me: MeResponse;
};

export function Step1UploadPage({ me: _me }: Step1UploadPageProps) {
  const navigate = useNavigate();
  const { isAllEntities, selectedEntity, entityHeaderValue } = useEntityContext();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAmendment, setIsAmendment] = useState<"yes" | "no">("no");
  const [parentContractId, setParentContractId] = useState("");
  const [parentError, setParentError] = useState<string | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [existingContracts, setExistingContracts] = useState<ContractSummary[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("time_and_material");
  const [currency, setCurrency] = useState<string>(selectedEntity?.allowedCurrencies[0] ?? "USD");
  const [currencyError, setCurrencyError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);

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
  const fileKind = useMemo(() => {
    if (!file) {
      return null;
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf") || file.type === "application/pdf") {
      return "pdf" as const;
    }
    if (lower.endsWith(".docx")) {
      return "docx" as const;
    }
    return "other" as const;
  }, [file]);

  async function loadParents() {
    const { data, response } = await apiClient.GET("/contracts", {
      params: {
        query: { status: "all" },
        header: { "X-Entity-Id": entityHeaderValue },
      },
    });
    if (response.ok && data) {
      setExistingContracts(data.contracts.filter((item) => !item.isDraft));
    }
  }

  function validate(showAll = false): boolean {
    let ok = true;
    if (!file) {
      if (showAll) {
        setFileError("Upload a client contract (.pdf or .docx).");
      }
      ok = false;
    } else {
      setFileError(undefined);
    }
    if (isAmendment === "yes" && !parentContractId) {
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
    if (!file) {
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    try {
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

      const created = await apiClient.POST("/contracts", {
        body: {
          clientFileKey: uploadData.fileKey,
          clientFileName: uploadData.fileName,
          clientFileContentType: uploadData.contentType,
          clientFileSizeBytes: uploadData.sizeBytes,
          isAmendment: isAmendment === "yes",
          parentContractId: isAmendment === "yes" ? parentContractId : undefined,
          category,
          currency: currency as "INR" | "USD" | "SAR",
        },
        params: { header: { "X-Entity-Id": entityHeaderValue } },
      });
      if (!created.response.ok || !created.data) {
        const err = created.error as { message?: string } | undefined;
        setError(err?.message || "Could not create draft contract.");
        return;
      }
      navigate(`/contracts/${created.data.id}/setup/2`, { replace: true });
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
        <div className="contract-file-drop">
          <p>Upload client contract (.pdf or .docx)</p>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label="Upload client contract"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setFileError(undefined);
            }}
            onBlur={() => {
              if (!file) {
                setFileError("Upload a client contract (.pdf or .docx).");
              }
            }}
          />
          {fileError ? <span className="ui-field-error">{fileError}</span> : null}
        </div>

        {file ? (
          <div className="contract-file-preview" data-testid="file-preview">
            <div className="contract-file-meta">
              <strong>{file.name}</strong>
              <span>
                {(fileKind ?? "file").toUpperCase()} · {formatBytes(file.size)}
              </span>
            </div>
            <div className="contract-file-actions">
              {previewUrl && (fileKind === "docx" || fileKind === "pdf") ? (
                <a href={previewUrl} download={file.name}>
                  Download
                </a>
              ) : null}
              <button type="button" onClick={() => setFile(null)}>
                Remove
              </button>
            </div>
            {previewUrl && fileKind === "pdf" ? (
              <iframe title="PDF preview" className="contract-file-frame" src={previewUrl} />
            ) : (
              <p className="contract-hint">
                {fileKind === "docx"
                  ? "DOCX preview is not available inline. Use Download to open the file."
                  : "Preview unavailable in this environment."}
              </p>
            )}
          </div>
        ) : null}

        <PillToggle
          label="Amendment"
          value={isAmendment}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
          onChange={(value) => {
            setIsAmendment(value);
            if (value === "yes") {
              void loadParents();
            }
          }}
        />

        {isAmendment === "yes" ? (
          <SelectField
            label="Parent contract"
            value={parentContractId}
            error={parentError}
            onChange={(event) => {
              setParentContractId(event.target.value);
              setParentError(undefined);
            }}
            onBlur={() => {
              if (!parentContractId) {
                setParentError("Select the parent contract for this amendment.");
              }
            }}
          >
            <option value="">Select contract</option>
            {existingContracts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.reference}
              </option>
            ))}
          </SelectField>
        ) : (
          <p className="contract-hint">Contract reference will be generated automatically on continue.</p>
        )}

        <PillToggle
          label="Category"
          value={category}
          options={CATEGORIES}
          onChange={setCategory}
        />

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
