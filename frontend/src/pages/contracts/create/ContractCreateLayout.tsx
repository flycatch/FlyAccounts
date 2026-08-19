import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useEntityContext } from "../../../entity/EntityContext";
import "./ContractCreate.css";

type ContractCreateLayoutProps = {
  step: 1 | 2 | 3;
  title: string;
  reference?: string | null;
  error?: string | null;
  footer: ReactNode;
  children: ReactNode;
};

const STEPS = [
  { n: 1, label: "Upload" },
  { n: 2, label: "Closure" },
  { n: 3, label: "Payment" },
] as const;

export function ContractCreateLayout({
  step,
  title,
  reference,
  error,
  footer,
  children,
}: ContractCreateLayoutProps) {
  const { selectedEntity } = useEntityContext();

  return (
    <div className="contract-create">
      <div className="contract-create-top">
        <Link to="/contracts" className="contract-create-back">
          ← Contracts
        </Link>
        <span className="contract-create-entity" data-testid="entity-pill">
          {selectedEntity?.name ?? "Entity"}
        </span>
        {reference ? <span className="contract-create-ref">{reference}</span> : null}
      </div>

      <nav className="contract-create-steps" aria-label="Creation steps">
        {STEPS.map((item) => (
          <div
            key={item.n}
            className={`contract-create-step${item.n === step ? " is-active" : ""}${
              item.n < step ? " is-done" : ""
            }`}
          >
            <span className="contract-create-step-num">{item.n}</span>
            <span className="contract-create-step-label">{item.label}</span>
          </div>
        ))}
      </nav>

      <header className="contract-create-header">
        <h2>{title}</h2>
        <p>Step {step} of 3</p>
      </header>

      {error ? <p className="contracts-error">{error}</p> : null}

      <div className="contract-create-body">{children}</div>
      <div className="contract-create-footer">{footer}</div>
    </div>
  );
}
