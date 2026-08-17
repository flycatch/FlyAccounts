import type { ReactNode } from "react";

import "./EntityCard.css";

type EntityCardProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
};

export function EntityCard({
  title,
  subtitle,
  meta,
  selected = false,
  onSelect,
  children,
}: EntityCardProps) {
  const className = `entity-card${selected ? " is-selected" : ""}${onSelect ? "" : " is-static"}`;
  const content = (
    <>
      <p className="entity-card-title">{title}</p>
      {subtitle ? <p className="entity-card-subtitle">{subtitle}</p> : null}
      {meta ? <div className="entity-card-meta">{meta}</div> : null}
      {children}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={className}
        onClick={onSelect}
        aria-pressed={selected}
      >
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}
