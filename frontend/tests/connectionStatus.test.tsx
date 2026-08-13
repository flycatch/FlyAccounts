import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const getStatus = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => getStatus(...args),
  },
}));

import { StatusPage } from "../src/pages/StatusPage";

describe("connection status", () => {
  beforeEach(() => {
    getStatus.mockReset();
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
});
