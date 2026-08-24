import { useEffect, useState } from "react";

import type { components } from "../../api/schema";
import { apiClient } from "../../api/client";

type ProformaLetterhead = components["schemas"]["ProformaLetterhead"];

export function useProformaLetterhead() {
  const [letterhead, setLetterhead] = useState<ProformaLetterhead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, response } = await apiClient.GET("/proformas/letterhead");
      if (cancelled) {
        return;
      }
      if (!response.ok || !data) {
        setError("Could not load letterhead.");
        setLetterhead(null);
        setLoading(false);
        return;
      }
      setLetterhead(data);
      setError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { letterhead, loading, error };
}
