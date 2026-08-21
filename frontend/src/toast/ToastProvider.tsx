import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import "./Toast.css";

type ToastTone = "success" | "error";

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const timers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const text = message.trim();
      if (!text) {
        return;
      }
      setToasts((current) => {
        const withoutDup = current.filter((item) => !(item.tone === tone && item.message === text));
        const id = idRef.current++;
        const timer = window.setTimeout(() => dismiss(id), DISMISS_MS);
        timers.current.set(id, timer);
        return [...withoutDup, { id, tone, message: text }];
      });
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span>{toast.message}</span>
            <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    if ("message" in payload && typeof (payload as { message: unknown }).message === "string") {
      const message = (payload as { message: string }).message.trim();
      if (message) {
        return message;
      }
    }
    if ("code" in payload) {
      const code = (payload as { code: string }).code;
      const mapped: Record<string, string> = {
        duplicate_assignment: "That role is already assigned.",
        duplicate_invite: "That email is already invited.",
        already_present: "That person is already listed.",
        last_admin_required: "At least one person with manage users must remain.",
        role_still_assigned: "That role is still assigned to a person.",
        duplicate_role_name: "A role with that name already exists.",
        duplicate_permission: "That permission is already attached to the role.",
        client_in_use: "This client is linked to contracts and cannot be deleted.",
        duplicate_client_name: "A client with that name already exists.",
        invite_email_failed: "The invitation email could not be sent.",
      };
      if (mapped[code]) {
        return mapped[code];
      }
    }
  }
  return fallback;
}
