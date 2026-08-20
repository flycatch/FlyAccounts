import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

import { EntityProvider } from "../src/entity/EntityContext";
import { ResourcesPage } from "../src/pages/resources/ResourcesPage";
import { ToastProvider } from "../src/toast/ToastProvider";

const entityA = {
  id: "aaaaaaaa-0000-4000-8000-0000000000a1",
  code: "entity_a" as const,
  name: "Entity A",
  allowedCurrencies: ["INR", "USD"] as ("INR" | "USD" | "SAR")[],
  active: true,
};

const overAllocated = {
  id: "rrrrrrrr-0000-4000-8000-000000000001",
  resourceType: "inhouse" as const,
  name: "Alex Dev",
  monthlyAllocationPercent: 150,
  contractId: "cccccccc-0000-4000-8000-000000000001",
  contractReference: "CTR-0133",
  month: "2026-08",
  createdAt: "2026-08-01T00:00:00Z",
};

const normalResource = {
  ...overAllocated,
  id: "rrrrrrrr-0000-4000-8000-000000000002",
  name: "Pat Vendor",
  monthlyAllocationPercent: 80,
  resourceType: "vendor" as const,
};

function renderResources(initialEntry = "/resources") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EntityProvider>
        <ToastProvider>
          <ResourcesPage />
        </ToastProvider>
      </EntityProvider>
    </MemoryRouter>,
  );
}

describe("ResourcesPage", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
    sessionStorage.clear();
    sessionStorage.setItem("flyaccounts.entityId", entityA.id);

    get.mockImplementation((path: string) => {
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [entityA] },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/resources") {
        return Promise.resolve({
          data: {
            resources: [overAllocated, normalResource],
            page: 1,
            pageSize: 10,
            total: 2,
          },
          error: undefined,
          response: { ok: true },
        });
      }
      if (path === "/contracts") {
        return Promise.resolve({
          data: {
            contracts: [
              {
                id: overAllocated.contractId,
                entityId: entityA.id,
                entityName: entityA.name,
                reference: "CTR-0133",
                category: "time_and_material",
                currency: "INR",
                isAmendment: false,
                isDraft: false,
                clientFileKey: "contracts/x.pdf",
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
      return Promise.resolve({ data: undefined, error: undefined, response: { ok: false } });
    });
  });

  it("shows over-allocated pill only when percent is greater than 100", async () => {
    renderResources();
    expect(await screen.findByText("Alex Dev")).toBeInTheDocument();
    expect(screen.getByTestId("over-allocated-pill")).toHaveTextContent("Over allocated");
    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getAllByTestId("over-allocated-pill")).toHaveLength(1);
  });

  it("disables add when all entities is selected", async () => {
    sessionStorage.setItem("flyaccounts.entityId", "*");
    renderResources();
    expect(await screen.findByTestId("entity-pill")).toHaveTextContent("All Entities");
    expect(screen.getByRole("button", { name: /\+ add resource/i })).toBeDisabled();
  });

  it("validates required fields on blur and submit without blocking over-allocation", async () => {
    post.mockResolvedValue({
      data: overAllocated,
      error: undefined,
      response: { ok: true, status: 201 },
    });
    renderResources();
    await screen.findByText("Alex Dev");

    fireEvent.click(screen.getByRole("button", { name: /\+ add resource/i }));
    const name = await screen.findByLabelText(/resource name/i);
    fireEvent.blur(name);
    expect(await screen.findByText(/resource name is required/i)).toBeInTheDocument();

    fireEvent.change(name, { target: { value: "New Person" } });
    fireEvent.change(screen.getByLabelText(/monthly allocation %/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/^month$/i), { target: { value: "2026-09" } });

    const contract = screen.getByLabelText(/^contract$/i);
    fireEvent.focus(contract);
    fireEvent.click(await screen.findByRole("option", { name: /CTR-0133/i }));

    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        "/resources",
        expect.objectContaining({
          body: expect.objectContaining({
            name: "New Person",
            monthlyAllocationPercent: 150,
            month: "2026-09",
            contractId: overAllocated.contractId,
          }),
        }),
      );
    });
    expect(await screen.findByText("Resource created.")).toBeInTheDocument();
  });

  it("keeps search, page, pageSize, and sort in the URL and resets page on search", async () => {
    renderResources("/resources?search=alex&page=2&pageSize=25&sortBy=name&sortOrder=desc");
    await screen.findByText("Alex Dev");

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        "/resources",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              search: "alex",
              page: 2,
              pageSize: 25,
              sortBy: "name",
              sortOrder: "desc",
            }),
          }),
        }),
      );
    });

    const search = screen.getByLabelText(/search resources/i);
    fireEvent.change(search, { target: { value: "pat" } });

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith(
        "/resources",
        expect.objectContaining({
          params: expect.objectContaining({
            query: expect.objectContaining({
              search: "pat",
              page: 1,
            }),
          }),
        }),
      );
    });
  });
});
