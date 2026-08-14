import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens, storeTokens } from "../src/auth/tokens";
import { CombinedLandingPage } from "../src/pages/CombinedLandingPage";
import { PendingAccessPage } from "../src/pages/PendingAccessPage";

describe("sign out", () => {
  beforeEach(() => {
    clearTokens();
    getMe.mockReset();
    getMe.mockResolvedValue({
      data: undefined,
      error: { code: "unauthorized" },
      response: { ok: false, status: 401 },
    });
  });

  it("clears tokens from pending access and returns to sign-in", async () => {
    storeTokens("access-1", "refresh-1");
    render(<PendingAccessPage onSignedOut={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => {
      expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });
  });

  it("clears tokens from the combined landing", async () => {
    storeTokens("access-1", "refresh-1");
    render(
      <CombinedLandingPage
        me={{
          id: "00000000-0000-0000-0000-000000000002",
          displayName: "Alex Example",
          upn: "alex@contoso.com",
          roles: [{ id: "role-hr", name: "HR User" }],
          permissions: ["hr_landing"],
          landing: {
            accessState: "authorized",
            sections: [{ code: "hr_landing", title: "HR", body: "HR" }],
          },
        }}
        onSignedOut={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => {
      expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    });
  });

  it("unsigned visitors see Microsoft sign-in after tokens are cleared", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByText(/assigned roles/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your access is pending/i)).not.toBeInTheDocument();
  });
});
