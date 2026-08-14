import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: vi.fn(() => new Promise(() => undefined)),
  },
}));

vi.mock("../src/auth/msal", () => ({
  loginWithMicrosoft: vi.fn(),
}));

import App from "../src/App";
import { StatusPage } from "../src/pages/StatusPage";
import { clearTokens } from "../src/auth/tokens";

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

  it("is not shown as a public home when unsigned", async () => {
    clearTokens();
    render(<App />);
    expect(await screen.findByRole("button", { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByText("The application is connected successfully.")).not.toBeInTheDocument();
    expect(screen.queryByText("The application is working.")).not.toBeInTheDocument();
  });
});
