import type { ReactNode } from "react";

import "./DetailPanel.css";

type DetailPanelProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
  emptyMessage?: string;
};

export function DetailPanel({ title, subtitle, actions, children, emptyMessage }: DetailPanelProps) {
  if (!title) {
    return (
      <aside className="detail-panel">
        <p className="detail-panel-empty">{emptyMessage ?? "Select an item to view details."}</p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="detail-panel-header">
        <div className="detail-panel-heading">
          <h2 className="detail-panel-title">{title}</h2>
          {subtitle ? <p className="detail-panel-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="detail-panel-actions">{actions}</div> : null}
      </div>
      {children ? <div className="detail-panel-body">{children}</div> : null}
    </aside>
  );
}
