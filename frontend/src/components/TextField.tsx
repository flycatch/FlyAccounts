import type { InputHTMLAttributes } from "react";

import "./forms.css";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, id, ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;
  const invalid = Boolean(error) || props["aria-invalid"] === true;

  return (
    <label className="ui-field" htmlFor={fieldId}>
      {label}
      <input
        id={fieldId}
        className={`ui-control${invalid ? " is-invalid" : ""}`}
        aria-invalid={invalid || undefined}
        {...props}
      />
      {error ? <span className="ui-field-error">{error}</span> : null}
    </label>
  );
}
