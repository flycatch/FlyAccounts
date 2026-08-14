import { clearTokens, getRefreshToken, storeTokens } from "./tokens";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1";

export async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return false;
  }

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    return false;
  }
  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  storeTokens(data.accessToken, data.refreshToken);
  return true;
}
