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
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens, signOut, storeTokens } from "../src/auth/tokens";
import { EntityProvider } from "../src/entity/EntityContext";
import { AppShell } from "../src/layout/AppShell";
import { PendingAccessPage } from "../src/pages/PendingAccessPage";

describe("sign out", () => {
  beforeEach(() => {
    clearTokens();
    getMe.mockReset();
    getMe.mockImplementation((path: string) => {
      if (path === "/entities") {
        return Promise.resolve({
          data: { entities: [] },
          error: undefined,
          response: { ok: true },
        });
      }
      return Promise.resolve({
        data: undefined,
        error: { code: "unauthorized" },
        response: { ok: false, status: 401 },
      });
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

  it("clears tokens from the app shell sidebar", async () => {
    storeTokens("access-1", "refresh-1");
    render(
      <EntityProvider>
        <AppShell
          pathname="/"
          showSettings={false}
          canUsers={false}
          canRoles={false}
          canPermissions={false}
          canClients={false}
          canResources={false}
          canContracts={false}
          onNavigate={() => undefined}
          onSignOut={() => {
            void signOut();
          }}
        >
          <p>Home content</p>
        </AppShell>
      </EntityProvider>,
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
