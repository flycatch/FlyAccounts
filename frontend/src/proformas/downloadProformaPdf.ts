import { getAccessToken } from "../auth/tokens";
import { getActiveEntityHeader } from "../entity/entityHeader";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/v1";

export async function downloadProformaPdf(proformaId: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/proformas/${proformaId}/pdf`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Entity-Id": getActiveEntityHeader(),
    },
  });
  if (!response.ok) {
    throw new Error("Could not download proforma PDF.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
