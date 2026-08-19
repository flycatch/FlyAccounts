import createClient from "openapi-fetch";

import type { paths } from "./schema";
import { refreshSession } from "../auth/refresh";
import { getAccessToken } from "../auth/tokens";
import { getActiveEntityHeader } from "../entity/entityHeader";

export const apiClient = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1",
});

apiClient.use({
  onRequest({ request }) {
    const token = getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    const path = new URL(request.url).pathname;
    if (path.includes("/contracts") || path.endsWith("/entities")) {
      request.headers.set("X-Entity-Id", getActiveEntityHeader());
    }
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401) {
      return response;
    }
    const path = new URL(request.url).pathname;
    if (path.endsWith("/auth/refresh") || path.endsWith("/auth/microsoft") || path.endsWith("/auth/logout")) {
      return response;
    }
    if (request.headers.get("X-Retry-Refresh") === "1") {
      return response;
    }
    const refreshed = await refreshSession();
    if (!refreshed) {
      return response;
    }
    const headers = new Headers(request.headers);
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    headers.set("X-Retry-Refresh", "1");
    return fetch(new Request(request, { headers }));
  },
});
