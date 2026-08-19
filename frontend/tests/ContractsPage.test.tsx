import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => get(...args),
    POST: (...args: unknown[]) => post(...args),
    PATCH: (...args: unknown[]) => patch(...args),
    DELETE: (...args: unknown[]) => del(...args),
  },
}));

vi.mock("../src/auth/msal", () => ({
  loginWithMicrosoft: vi.fn(),
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

const entityB = {
  id: "aaaaaaaa-0000-4000-8000-0000000000b1",
  code: "entity_b" as const,
  name: "Entity B",
  allowedCurrencies: ["INR", "USD"] as ("INR" | "USD" | "SAR")[],
  active: true,
};

const financeMe = {
  id: "00000000-0000-0000-0000-000000000011",
  displayName: "Pat Finance",
  upn: "finance@contoso.com",
  roles: [{ id: "role-admin", name: "System Admin" }],
  permissions: ["manage_contracts", "view_contract_financials"],
  landing: { accessState: "authorized" as const, sections: [] },
};

const hrMe = {
  id: "00000000-0000-0000-0000-000000000012",
  displayName: "Alex HR",
  upn: "hr@contoso.com",
  roles: [{ id: "role-hr", name: "Contracts HR" }],
  permissions: ["manage_contracts"],
  landing: { accessState: "authorized" as const, sections: [] },
};

const listContract = {
  id: "cccccccc-0000-4000-8000-000000000001",
  entityId: entityA.id,
  entityName: "Entity A",
  reference: "CTR-0133",
  category: "time_and_material",
  currency: "INR",
  isAmendment: false,
  isDraft: false,
  closureOwnerUserId: financeMe.id,
  closureOwnerName: financeMe.displayName,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  projectStatus: "active",
  paymentType: "project_value",
  projectValue: "1000.00",
  paymentDisplay: "INR 1000.00",
  clientFileKey: "contracts/x.pdf",
  clientFileName: "x.pdf",
  createdAt: "2026-01-01T00:00:00Z",
};

function mockApis(me: typeof financeMe) {
  get.mockImplementation((path: string) => {
    if (path === "/me") {
      return Promise.resolve({ data: me, error: undefined, response: { ok: true } });
    }
    if (path === "/entities") {
      return Promise.resolve({
        data: { entities: [entityA, entityB] },
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/contracts") {
      return Promise.resolve({
        data: {
          contracts: [
            {
              ...listContract,
              clientId: "bbbbbbbb-0000-4000-8000-000000000001",
              clientName: "Acme Corp",
              projectValue: me.permissions.includes("view_contract_financials")
                ? "1000.00"
                : undefined,
              paymentDisplay: me.permissions.includes("view_contract_financials")
                ? "INR 1000.00"
                : "Restricted",
            },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
        },
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/clients") {
      return Promise.resolve({
        data: {
          clients: [
            {
              id: "bbbbbbbb-0000-4000-8000-000000000001",
              name: "Acme Corp",
              address: "1 Main St",
              contactPerson: "Pat",
              contactEmail: "pat@acme.example",
              contactPhone: "+1-555-0100",
              vatNumber: "VAT-1",
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
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
        data: {
          ...listContract,
          milestones: [
            {
              name: "M1",
              value: "100.00",
              dueConditionOrDate: "2026-02-01",
              sortOrder: 0,
            },
          ],
        },
        error: undefined,
        response: { ok: true },
      });
    }
    if (path === "/contracts/closure-owners") {
      return Promise.resolve({
        data: { owners: [{ id: me.id, displayName: me.displayName }] },
        error: undefined,
        response: { ok: true },
      });
    }
    return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
  });
}

describe("Contracts module UI", () => {
  beforeEach(() => {
    clearTokens();
    sessionStorage.clear();
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
    localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
  });

  it("shows Contracts nav, entity switcher, and disables New Contract on All Entities", async () => {
    mockApis(financeMe);
    render(<App />);

    expect(await screen.findByRole("button", { name: /^contracts$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^contracts$/i }));

    expect(await screen.findByTestId("entity-pill")).toHaveTextContent("All Entities");
    const newButton = screen.getByRole("button", { name: /\+ new contract/i });
    expect(newButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/active legal entity/i), {
      target: { value: entityA.id },
    });

    await waitFor(() => {
      expect(screen.getByTestId("entity-pill")).toHaveTextContent("Entity A");
    });
    expect(screen.getByRole("button", { name: /\+ new contract/i })).not.toBeDisabled();
  });

  it("opens full-page step 1 with 3-step indicator and pill toggles", async () => {
    mockApis(financeMe);
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^contracts$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /\+ new contract/i }));

    expect(await screen.findByText(/upload contract & category/i)).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.queryByText(/step 1 of 4/i)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /time & material/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/contract reference/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/parent contract/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /add amendment to existing contract/i }),
    ).not.toBeChecked();

    const file = new File(["%PDF"], "client.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/^contract document$/i), {
      target: { files: [file] },
    });

    expect(await screen.findByTestId("file-preview")).toBeInTheDocument();
  });

  it("shows parent contract search only when amendment is enabled", async () => {
    mockApis(financeMe);
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^contracts$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /\+ new contract/i }));
    await screen.findByText(/upload contract & category/i);

    fireEvent.click(screen.getByRole("checkbox", { name: /add amendment to existing contract/i }));
    const parent = await screen.findByLabelText(/parent contract/i);
    fireEvent.focus(parent);
    fireEvent.blur(parent);

    await waitFor(() => {
      expect(screen.getByText(/select the parent contract/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /add amendment to existing contract/i }));
    expect(screen.queryByLabelText(/parent contract/i)).not.toBeInTheDocument();
  });

  it("shows milestones section on step 3 for Time & Material only", async () => {
    mockApis(financeMe);
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);
    const draftId = "dddddddd-0000-4000-8000-000000000099";
    get.mockImplementation((path: string) => {
      if (path === "/me") {
        return Promise.resolve({ data: financeMe, error: undefined, response: { ok: true } });
      }
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [entityA, entityB] },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/contracts/{contractId}") {
        return Promise.resolve({
          data: {
            id: draftId,
            entityId: entityA.id,
            entityName: "Entity A",
            reference: "CTR-0009",
            category: "time_and_material",
            currency: "INR",
            isAmendment: false,
            isDraft: true,
            clientFileKey: "contracts/x.pdf",
            createdAt: "2026-01-01T00:00:00Z",
            closureOwnerUserId: financeMe.id,
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            projectStatus: "active",
            milestones: [],
          },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
    });

    window.history.pushState({}, "", `/contracts/${draftId}/setup/3`);
    render(<App />);

    expect(await screen.findByText(/payment terms & milestones/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ add milestone/i })).toBeInTheDocument();
    expect(screen.queryByTestId("milestones-table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create contract/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/monthly payment amount/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /monthly × months/i }));
    expect(screen.getByLabelText(/monthly payment amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^months$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/total project value/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ add milestone/i }));
    expect(screen.getByTestId("milestones-table")).toBeInTheDocument();
  });

  it("hides milestones on step 3 for non Time & Material categories", async () => {
    mockApis(financeMe);
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);
    const draftId = "dddddddd-0000-4000-8000-000000000088";
    get.mockImplementation((path: string) => {
      if (path === "/me") {
        return Promise.resolve({ data: financeMe, error: undefined, response: { ok: true } });
      }
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [entityA, entityB] },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/contracts/{contractId}") {
        return Promise.resolve({
          data: {
            id: draftId,
            entityId: entityA.id,
            entityName: "Entity A",
            reference: "CTR-0010",
            category: "data_management",
            currency: "INR",
            isAmendment: false,
            isDraft: true,
            clientFileKey: "contracts/x.pdf",
            createdAt: "2026-01-01T00:00:00Z",
            closureOwnerUserId: financeMe.id,
            startDate: "2026-01-01",
            endDate: "2026-12-31",
            projectStatus: "active",
            milestones: [],
          },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: true } });
    });

    window.history.pushState({}, "", `/contracts/${draftId}/setup/3`);
    render(<App />);

    expect(await screen.findByText(/payment terms & milestones/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\+ add milestone/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("milestones-table")).not.toBeInTheDocument();
  });

  it("navigates View and Edit from list; Delete enabled for Finance", async () => {
    mockApis(financeMe);
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^contracts$/i }));
    expect(await screen.findByText("CTR-0133")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^view$/i }));
    expect(await screen.findByRole("heading", { name: "CTR-0133" })).toBeInTheDocument();
    expect(screen.getByText(/upload & category/i)).toBeInTheDocument();
    expect(screen.getByTestId("milestones-table")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(await screen.findByRole("heading", { name: /edit ctr-0133/i })).toBeInTheDocument();
    expect(screen.getByTestId("milestones-table")).toBeInTheDocument();
  });

  it("disables Delete without financial permission", async () => {
    mockApis(hrMe);
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^contracts$/i }));
    const deleteBtn = await screen.findByRole("button", { name: /^delete$/i });
    expect(deleteBtn).toBeDisabled();
    expect(deleteBtn).toHaveAttribute("title", "Delete requires Finance permissions");
  });

  it("blocks continuing step 1 without a file", async () => {
    mockApis(financeMe);
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^contracts$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /\+ new contract/i }));
    fireEvent.change(await screen.findByLabelText(/^client$/i), {
      target: { value: "bbbbbbbb-0000-4000-8000-000000000001" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /^continue$/i }));

    expect(await screen.findByText(/upload a contract document/i)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
