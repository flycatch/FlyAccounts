import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

const getMe = vi.fn();

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: (...args: unknown[]) => getMe(...args),
    POST: vi.fn(),
  },
}));

vi.mock("../src/auth/msal", () => ({
  loginWithMicrosoft: vi.fn(),
}));

import App from "../src/App";
import { ACCESS_TOKEN_KEY, clearTokens } from "../src/auth/tokens";
import { PendingAccessPage } from "../src/pages/PendingAccessPage";

describe("pending access", () => {
  beforeEach(() => {
    clearTokens();
    getMe.mockReset();
  });

  it("routes a no-role session to pending access", async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, "access-token");
    getMe.mockResolvedValue({
      data: {
        id: "00000000-0000-0000-0000-000000000001",
        displayName: "Alex Example",
        upn: "alex@contoso.com",
        roles: [],
        permissions: [],
        landing: { accessState: "pending", sections: [] },
      },
      error: undefined,
      response: { ok: true, status: 200 },
    });

    render(<App />);

    expect(await screen.findByText(/your access is pending/i)).toBeInTheDocument();
    expect(screen.queryByText(/access administration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/assigned roles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/the application is connected successfully/i)).not.toBeInTheDocument();
  });

  it("does not show landing or admin on the pending page itself", () => {
    render(<PendingAccessPage onSignedOut={() => undefined} />);
    expect(screen.getByText(/your access is pending/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /access administration/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/assigned roles/i)).not.toBeInTheDocument();
  });
});
