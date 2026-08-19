import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export type SortOrder = "asc" | "desc";

function parsePage(value: string | null): number {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

function parsePageSize(value: string | null): PageSize {
  const parsed = Number(value ?? "10");
  if (parsed === 10 || parsed === 25 || parsed === 50) {
    return parsed;
  }
  return 10;
}

function parseSortOrder(value: string | null): SortOrder {
  return value === "desc" ? "desc" : "asc";
}

export function useListQueryParams(options?: {
  extraKeys?: string[];
  defaultSortBy?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const sortBy = searchParams.get("sortBy") ?? options?.defaultSortBy ?? "";
  const sortOrder = parseSortOrder(searchParams.get("sortOrder"));
  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const trimmed = searchInput.trim();
    const current = search.trim();
    if (trimmed === current) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) {
            next.set("search", trimmed);
          } else {
            next.delete("search");
          }
          next.set("page", "1");
          if (!next.get("pageSize")) {
            next.set("pageSize", String(pageSize));
          }
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, pageSize, setSearchParams]);

  const setPage = useCallback(
    (nextPage: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(Math.max(1, nextPage)));
        if (!next.get("pageSize")) {
          next.set("pageSize", String(pageSize));
        }
        return next;
      });
    },
    [pageSize, setSearchParams],
  );

  const setPageSize = useCallback(
    (nextSize: PageSize) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("pageSize", String(nextSize));
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setSort = useCallback(
    (column: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const currentBy = prev.get("sortBy") ?? options?.defaultSortBy ?? "";
        const currentOrder = parseSortOrder(prev.get("sortOrder"));
        if (currentBy === column) {
          next.set("sortOrder", currentOrder === "asc" ? "desc" : "asc");
        } else {
          next.set("sortBy", column);
          next.set("sortOrder", "asc");
        }
        next.set("page", "1");
        if (!next.get("pageSize")) {
          next.set("pageSize", String(pageSize));
        }
        return next;
      });
    },
    [options?.defaultSortBy, pageSize, setSearchParams],
  );

  const setExtra = useCallback(
    (key: string, value: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const extras: Record<string, string> = {};
  for (const key of options?.extraKeys ?? []) {
    const value = searchParams.get(key);
    if (value !== null) {
      extras[key] = value;
    }
  }

  return {
    search,
    searchInput,
    setSearchInput,
    page,
    pageSize,
    setPage,
    setPageSize,
    sortBy,
    sortOrder,
    setSort,
    setExtra,
    extras,
    searchParams,
  };
}
