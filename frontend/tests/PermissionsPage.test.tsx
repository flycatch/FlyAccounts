import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const get = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => get(...args),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  },
}));

import { PermissionsPage } from "../src/pages/settings/PermissionsPage";

describe("PermissionsPage", () => {
  it("lists permissions grouped by module and has no create control", async () => {
    get.mockResolvedValue({
      data: {
        permissions: [
          { id: "1", code: "access_administration", name: "Access administration", module: "settings" },
          { id: "2", code: "finance_landing", name: "Finance landing", module: "finance" },
          {
            id: "3",
            code: "view_sensitive_financial_fields",
            name: "View sensitive financial fields",
            module: "finance",
            action: "view_sensitive_financial_fields",
          },
        ],
      },
      error: undefined,
      response: { ok: true },
    });

    render(<PermissionsPage />);
    expect(
      await screen.findByText(/read-only catalog grouped by module/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^finance$/i })).toBeInTheDocument();
    expect(screen.getByText("Access administration")).toBeInTheDocument();
    expect(screen.getAllByText("Whole-module grant").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rename/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
