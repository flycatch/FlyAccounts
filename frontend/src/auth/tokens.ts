export const ACCESS_TOKEN_KEY = "flyaccounts.accessToken";
export const REFRESH_TOKEN_KEY = "flyaccounts.refreshToken";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1";

export async function signOut(): Promise<void> {
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();
  try {
    if (refreshToken && accessToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    clearTokens();
  }
}
