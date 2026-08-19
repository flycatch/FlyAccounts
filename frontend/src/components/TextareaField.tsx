import type { TextareaHTMLAttributes } from "react";

import "./forms.css";

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label: string;
  error?: string;
};

export function TextareaField({ label, error, id, ...props }: TextareaFieldProps) {
  const fieldId = id ?? props.name;
  const invalid = Boolean(error) || props["aria-invalid"] === true;

  return (
    <label className="ui-field" htmlFor={fieldId}>
      {label}
      <textarea
        id={fieldId}
        className={`ui-control ui-textarea${invalid ? " is-invalid" : ""}`}
        aria-invalid={invalid || undefined}
        rows={props.rows ?? 3}
        {...props}
      />
      {error ? <span className="ui-field-error">{error}</span> : null}
    </label>
  );
}
