import type { SelectHTMLAttributes } from "react";

import "./forms.css";

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
  label: string;
  error?: string;
};

export function SelectField({ label, error, id, children, ...props }: SelectFieldProps) {
  const fieldId = id ?? props.name;
  const invalid = Boolean(error) || props["aria-invalid"] === true;

  return (
    <label className="ui-field" htmlFor={fieldId}>
      {label}
      <select
        id={fieldId}
        className={`ui-control${invalid ? " is-invalid" : ""}`}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="ui-field-error">{error}</span> : null}
    </label>
  );
}
