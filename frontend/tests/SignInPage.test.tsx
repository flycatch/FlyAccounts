import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

const loginWithMicrosoft = vi.fn();
const exchangeMicrosoftToken = vi.fn();

vi.mock("../src/auth/msal", () => ({
  loginWithMicrosoft: (...args: unknown[]) => loginWithMicrosoft(...args),
}));

vi.mock("../src/api/client", () => ({
  apiClient: {
    POST: (...args: unknown[]) => exchangeMicrosoftToken(...args),
    GET: vi.fn(),
  },
}));

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens } from "../src/auth/tokens";
import { SignInPage } from "../src/pages/SignInPage";

describe("SignInPage", () => {
  beforeEach(() => {
    clearTokens();
    loginWithMicrosoft.mockReset();
    exchangeMicrosoftToken.mockReset();
  });

  it("shows Microsoft sign-in", () => {
    render(<SignInPage onSignedIn={() => undefined} />);
    expect(screen.getByRole("button", { name: /sign in with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByText(/pending access/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/access administration/i)).not.toBeInTheDocument();
  });

  it("stays unsigned when Microsoft sign-in is cancelled", async () => {
    loginWithMicrosoft.mockRejectedValue({ errorCode: "user_cancelled" });
    render(<SignInPage onSignedIn={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with microsoft/i }));
    expect(await screen.findByText(/sign-in was cancelled or could not be completed/i)).toBeInTheDocument();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("stores tokens after a successful Microsoft exchange", async () => {
    loginWithMicrosoft.mockResolvedValue("id-token-value");
    exchangeMicrosoftToken.mockResolvedValue({
      data: {
        accessToken: "access-1",
        refreshToken: "refresh-1",
        tokenType: "bearer",
        expiresIn: 900,
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          displayName: "Alex",
          upn: "alex@contoso.com",
          roles: [],
          permissions: [],
          landing: { accessState: "pending", sections: [] },
        },
      },
      error: undefined,
      response: { ok: true, status: 200 },
    });
    const onSignedIn = vi.fn();
    render(<SignInPage onSignedIn={onSignedIn} />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with microsoft/i }));
    await waitFor(() => {
      expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBe("access-1");
      expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-1");
    });
    expect(onSignedIn).toHaveBeenCalled();
  });
});
