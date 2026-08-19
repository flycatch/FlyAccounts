import { useEffect, useId, useMemo, useRef, useState } from "react";

import "./forms.css";
import "./SearchableSelect.css";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  label: string;
  value: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onSearchChange?: (query: string) => void;
};

export function SearchableSelect({
  label,
  value,
  options,
  placeholder = "Search…",
  error,
  disabled,
  onChange,
  onBlur,
  onSearchChange,
}: SearchableSelectProps) {
  const fieldId = useId();
  const listId = `${fieldId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(
    () => options.find((item) => item.value === value)?.label ?? "",
    [options, value],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter((item) => item.label.toLowerCase().includes(term));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
    }
  }, [open, selectedLabel]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const invalid = Boolean(error);

  return (
    <div className="ui-field searchable-select" ref={rootRef}>
      <label htmlFor={fieldId}>{label}</label>
      <input
        id={fieldId}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={invalid || undefined}
        className={`ui-control${invalid ? " is-invalid" : ""}`}
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          onSearchChange?.("");
        }}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          onSearchChange?.(next);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              setOpen(false);
              onBlur?.();
            }
          }, 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
          }
          if (event.key === "Enter" && filtered.length === 1) {
            event.preventDefault();
            onChange(filtered[0].value);
            setOpen(false);
          }
        }}
      />
      {open ? (
        <ul id={listId} className="searchable-select-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="searchable-select-empty">No matches</li>
          ) : (
            filtered.map((item) => (
              <li key={item.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.value === value}
                  className={`searchable-select-option${item.value === value ? " is-selected" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {error ? <span className="ui-field-error">{error}</span> : null}
    </div>
  );
}
