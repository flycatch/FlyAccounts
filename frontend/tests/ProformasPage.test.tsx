import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => get(...args),
    POST: (...args: unknown[]) => post(...args),
    PATCH: (...args: unknown[]) => patch(...args),
    DELETE: vi.fn(),
  },
}));

vi.mock("../src/auth/msal", () => ({
  loginWithMicrosoft: vi.fn(),
}));

const downloadProformaPdf = vi.fn();
vi.mock("../src/proformas/downloadProformaPdf", () => ({
  downloadProformaPdf: (...args: unknown[]) => downloadProformaPdf(...args),
}));

import App from "../src/App";
import { ACCESS_TOKEN_KEY, clearTokens } from "../src/auth/tokens";

const entityA = {
  id: "aaaaaaaa-0000-4000-8000-0000000000a1",
  code: "entity_a" as const,
  name: "Entity A",
  allowedCurrencies: ["INR", "USD"] as ("INR" | "USD" | "SAR")[],
  active: true,
};

const financeMe = {
  id: "00000000-0000-0000-0000-000000000021",
  displayName: "Pat Finance",
  upn: "finance-pf@contoso.com",
  roles: [{ id: "role-admin", name: "System Admin" }],
  permissions: [
    "manage_contracts",
    "manage_proformas",
    "view_contract_financials",
    "manage_clients",
  ],
  landing: { accessState: "authorized" as const, sections: [] },
};

const contractDetail = {
  id: "cccccccc-0000-4000-8000-0000000000c1",
  entityId: entityA.id,
  entityName: "Entity A",
  reference: "CTR-0133",
  category: "time_and_material" as const,
  currency: "INR" as const,
  isAmendment: false,
  isDraft: false,
  clientId: "bbbbbbbb-0000-4000-8000-0000000000b1",
  clientName: "Acme Corp",
  clientAddress: "1 Main St",
  clientVatNumber: "VAT-100",
  clientEmail: "billing@acme.example",
  paymentType: "project_value" as const,
  projectValue: "2500.00",
  clientFileKey: "contracts/x.pdf",
  createdAt: "2026-01-01T00:00:00Z",
};

const letterhead = {
  companyAddressLine1: "10 Hangar Road",
  companyAddressLine2: "",
  companyCity: "Dubai",
  companyState: "",
  companyPostalCode: "",
  companyCountry: "UAE",
  companyPhone: "+971-0-000-0000",
  companyEmail: "billing@example.com",
  accountName: "Ops Account",
  accountNumber: "123456",
  iban: "AE00TEST",
  bankName: "Demo Bank",
  bankAddress: "Bank Plaza",
};

const proformaApproved = {
  id: "pppppppp-0000-4000-8000-000000000001",
  code: "PF-0001",
  entityId: entityA.id,
  entityName: "Entity A",
  contractId: contractDetail.id,
  contractReference: "CTR-0133",
  clientName: "Acme Corp",
  clientAddress: "1 Main St",
  clientVatNumber: "VAT-100",
  clientEmail: "billing@acme.example",
  estimatedAmount: "2500.00",
  currency: "INR" as const,
  validUntil: "2026-12-31",
  status: "approved" as const,
  createdAt: "2026-08-01T00:00:00Z",
};

const proformaDraft = {
  ...proformaApproved,
  id: "pppppppp-0000-4000-8000-000000000002",
  code: "PF-0002",
  status: "draft" as const,
};

function selectEntityA() {
  const switcher = screen.getByLabelText(/active legal entity/i);
  fireEvent.change(switcher, { target: { value: entityA.id } });
}

function mockApis() {
  get.mockImplementation((path: string, _init?: { params?: { path?: { contractId?: string; proformaId?: string } } }) => {
    if (path === "/me") {
      return Promise.resolve({ data: financeMe, error: undefined, response: { ok: true } });
    }
    if (path === "/entities") {
      return Promise.resolve({
        data: { entities: [entityA] },
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/proformas") {
      return Promise.resolve({
        data: {
          proformas: [proformaApproved, proformaDraft],
          page: 1,
          pageSize: 10,
          total: 2,
        },
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/proformas/letterhead") {
      return Promise.resolve({
        data: letterhead,
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/proformas/{proformaId}") {
      const id = _init?.params?.path?.proformaId;
      const row = id === proformaDraft.id ? proformaDraft : proformaApproved;
      return Promise.resolve({
        data: row,
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/contracts") {
      return Promise.resolve({
        data: {
          contracts: [contractDetail],
          page: 1,
          pageSize: 50,
          total: 1,
        },
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/contracts/{contractId}") {
      return Promise.resolve({
        data: contractDetail,
        error: undefined,
        response: { ok: true },
      });
    }
    return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
  });
  post.mockImplementation((path: string) => {
    if (path === "/proformas") {
      return Promise.resolve({
        data: {
          id: "pppppppp-0000-4000-8000-000000000099",
          code: "PF-0009",
          entityId: entityA.id,
          entityName: "Entity A",
          contractId: contractDetail.id,
          contractReference: "CTR-0133",
          clientName: "Acme Corp",
          estimatedAmount: "2500.00",
          currency: "INR",
          validUntil: "2026-12-31",
          status: "draft",
          createdAt: "2026-08-21T00:00:00Z",
        },
        error: undefined,
        response: { ok: true, status: 201 },
      });
    }
    return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
  });
  patch.mockResolvedValue({
    data: { ...proformaApproved, status: "shared_with_client" },
    error: undefined,
    response: { ok: true },
  });
}

describe("Proformas", () => {
  beforeEach(() => {
    clearTokens();
    sessionStorage.clear();
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    downloadProformaPdf.mockReset();
    downloadProformaPdf.mockResolvedValue(undefined);
    localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
    mockApis();
  });

  it("shows Proformas nav and list with icon actions and convert only for Approved", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /^proformas$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^proformas$/i }));
    expect(await screen.findByText("PF-0001")).toBeInTheDocument();
    expect(screen.getByText("PF-0002")).toBeInTheDocument();

    const convertButtons = screen.getAllByRole("button", { name: /convert to tax invoice/i });
    expect(convertButtons).toHaveLength(2);
    expect(convertButtons[0]).not.toBeDisabled();
    expect(convertButtons[1]).toBeDisabled();

    fireEvent.click(convertButtons[0]);
    expect(await screen.findByText(/coming soon/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /^download$/i })[0]);
    await waitFor(() => {
      expect(downloadProformaPdf).toHaveBeenCalledWith(proformaApproved.id, "PF-0001.pdf");
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^view proforma$/i })[0]);
    expect(await screen.findByTestId("proforma-invoice-document")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /proforma invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: /line items/i })).toBeInTheDocument();
    expect(screen.queryByText(/vat/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ops Account")).toBeInTheDocument();
  });

  it("creates a proforma independently and offers download", async () => {
    render(<App />);
    await screen.findByRole("button", { name: /^proformas$/i });
    selectEntityA();
    fireEvent.click(screen.getByRole("button", { name: /^proformas$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /\+ new proforma/i }));

    expect(await screen.findByTestId("proforma-tax-badge")).toHaveTextContent(
      /not tax-valid - for approval only/i,
    );
    expect(await screen.findByTestId("proforma-invoice-document")).toBeInTheDocument();
    const contractSelect = await screen.findByLabelText(/^contract$/i);
    expect(contractSelect).not.toBeDisabled();
    fireEvent.change(contractSelect, { target: { value: contractDetail.id } });

    await waitFor(() => {
      expect(screen.getByDisplayValue("INR")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2500.00")).toBeInTheDocument();
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });
    expect(screen.queryByText("VAT-100")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/valid until/i), {
      target: { value: "2026-12-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create proforma$/i }));

    await waitFor(() => {
      expect(post).toHaveBeenCalled();
    });
    expect(await screen.findByRole("button", { name: /^back to list$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^download$/i }));
    await waitFor(() => {
      expect(downloadProformaPdf).toHaveBeenCalledWith(
        "pppppppp-0000-4000-8000-000000000099",
        "PF-0009.pdf",
      );
    });
  });

  it("locks contract when opened from contract details", async () => {
    get.mockImplementation((path: string) => {
      if (path === "/me") {
        return Promise.resolve({ data: financeMe, error: undefined, response: { ok: true } });
      }
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [entityA] },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/contracts") {
        return Promise.resolve({
          data: { contracts: [contractDetail], page: 1, pageSize: 10, total: 1 },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/contracts/{contractId}") {
        return Promise.resolve({
          data: contractDetail,
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/proformas") {
        return Promise.resolve({
          data: { proformas: [], page: 1, pageSize: 10, total: 0 },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/proformas/letterhead") {
        return Promise.resolve({
          data: letterhead,
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
    });

    render(<App />);
    await screen.findByRole("button", { name: /^contracts$/i });
    selectEntityA();
    fireEvent.click(screen.getByRole("button", { name: /^contracts$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /view contract/i }));
    fireEvent.click(await screen.findByRole("button", { name: /create proforma/i }));

    const contractSelect = await screen.findByLabelText(/^contract$/i);
    expect(contractSelect).toBeDisabled();
    expect(contractSelect).toHaveValue(contractDetail.id);
    await waitFor(() => {
      expect(screen.getByText("billing@acme.example")).toBeInTheDocument();
    });
  });
});
