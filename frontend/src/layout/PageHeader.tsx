import type { ReactNode } from "react";

import "./PageHeader.css";

type PageHeaderProps = {
  title: string;
  actions?: ReactNode;
};

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1 className="page-header-title">{title}</h1>
      {actions}
    </header>
  );
}
