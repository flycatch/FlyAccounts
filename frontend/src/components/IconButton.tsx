import type { ButtonHTMLAttributes, ReactNode } from "react";

import "./IconButton.css";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  label: string;
  icon: ReactNode;
  danger?: boolean;
};

export function IconButton({ label, icon, danger = false, className, type = "button", ...props }: IconButtonProps) {
  return (
    <span className="ui-tooltip-wrap">
      <button
        type={type}
        className={`ui-icon-button${danger ? " is-danger" : ""}${className ? ` ${className}` : ""}`}
        aria-label={label}
        {...props}
      >
        {icon}
      </button>
      <span className="ui-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}
