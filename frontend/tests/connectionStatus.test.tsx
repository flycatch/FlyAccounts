import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const getStatus = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => getStatus(...args),
  },
}));

vi.mock("../src/auth/msal", () => ({
  loginWithMicrosoft: vi.fn(),
}));

import App from "../src/App";
import { StatusPage } from "../src/pages/StatusPage";
import { ACCESS_TOKEN_KEY, clearTokens } from "../src/auth/tokens";

describe("connection status", () => {
  beforeEach(() => {
    getStatus.mockReset();
    clearTokens();
  });

  it("shows connected successfully on HTTP 200 and never not-connected", async () => {
    getStatus.mockResolvedValue({
      data: { service: "ok", database: "ok", storage: "ok" },
      error: undefined,
      response: { ok: true, status: 200 },
    });

    render(<StatusPage />);

    expect(await screen.findByText("The application is connected successfully.")).toBeInTheDocument();
    expect(screen.queryByText("The application is not connected.")).not.toBeInTheDocument();
    expect(screen.getByText("Database: ok")).toBeInTheDocument();
    expect(screen.getByText("Storage: ok")).toBeInTheDocument();
  });

  it("shows not connected on fetch failure and never connected-success", async () => {
    getStatus.mockRejectedValue(new Error("network"));

    render(<StatusPage />);

    expect(await screen.findByText("The application is not connected.")).toBeInTheDocument();
    expect(screen.queryByText("The application is connected successfully.")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/Database:/)).not.toBeInTheDocument();
    });
  });

  it("unsigned visitors never see connection confirmation as a public home", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByText("The application is connected successfully.")).not.toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });
});
