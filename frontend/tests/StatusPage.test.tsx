import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: vi.fn(() => new Promise(() => undefined)),
  },
}));

import { StatusPage } from "../src/pages/StatusPage";

describe("StatusPage", () => {
  it("states that the application is working", () => {
    render(<StatusPage />);
    expect(screen.getByText("The application is working.")).toBeInTheDocument();
  });

  it("does not show accounting features", () => {
    render(<StatusPage />);
    expect(screen.queryByText(/invoice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ledger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/legal entit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tax/i)).not.toBeInTheDocument();
  });
});
