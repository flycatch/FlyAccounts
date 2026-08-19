import { useCallback, useState } from "react";

type ValidatorMap<T extends string> = Record<T, (value: string) => string | undefined>;

export function useFormErrors<T extends string>(validators: ValidatorMap<T>) {
  const [errors, setErrors] = useState<Partial<Record<T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const validateField = useCallback(
    (field: T, value: string) => {
      const message = validators[field](value);
      setErrors((current) => {
        const next = { ...current };
        if (message) {
          next[field] = message;
        } else {
          delete next[field];
        }
        return next;
      });
      return message;
    },
    [validators],
  );

  const onBlur = useCallback(
    (field: T, value: string) => {
      setTouched((current) => ({ ...current, [field]: true }));
      validateField(field, value);
    },
    [validateField],
  );

  const validateAll = useCallback(
    (values: Record<T, string>) => {
      setSubmitted(true);
      const next: Partial<Record<T, string>> = {};
      let ok = true;
      for (const field of Object.keys(validators) as T[]) {
        const message = validators[field](values[field] ?? "");
        if (message) {
          next[field] = message;
          ok = false;
        }
      }
      setErrors(next);
      return ok;
    },
    [validators],
  );

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
    setSubmitted(false);
  }, []);

  const fieldError = useCallback(
    (field: T) => {
      if (touched[field] || submitted) {
        return errors[field];
      }
      return undefined;
    },
    [errors, submitted, touched],
  );

  return { errors, fieldError, onBlur, validateAll, clearErrors, submitted };
}

export function required(label: string) {
  return (value: string) => (value.trim() ? undefined : `${label} is required.`);
}

export function emailFormat(label = "Email") {
  return (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return `${label} is required.`;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return `${label} must be a valid email address.`;
    }
    return undefined;
  };
}

export function requiredNumber(label: string) {
  return (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return `${label} is required.`;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return `${label} must be a number.`;
    }
    return undefined;
  };
}
