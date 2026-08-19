import "./PillToggle.css";

type PillOption<T extends string> = {
  value: T;
  label: string;
};

type PillToggleProps<T extends string> = {
  label: string;
  options: readonly PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  error?: string;
  name?: string;
};

export function PillToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  name,
}: PillToggleProps<T>) {
  return (
    <fieldset className={`pill-toggle${error ? " is-invalid" : ""}`} name={name}>
      <legend>{label}</legend>
      <div className="pill-toggle-row" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={`pill-toggle-btn${value === option.value ? " is-active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error ? <span className="ui-field-error">{error}</span> : null}
    </fieldset>
  );
}
