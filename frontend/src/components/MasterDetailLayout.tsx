import type { ReactNode } from "react";

import backIcon from "../assets/icons/back.svg";
import { IconButton } from "./IconButton";
import "./MasterDetailLayout.css";

type MasterDetailLayoutProps = {
  selected: boolean;
  list: ReactNode;
  detail: ReactNode;
  onBack: () => void;
};

export function MasterDetailLayout({ selected, list, detail, onBack }: MasterDetailLayoutProps) {
  return (
    <div className={`master-detail${selected ? " is-selected" : ""}`}>
      <div className="master-detail-list">
        <div className="master-detail-list-inner">{list}</div>
      </div>
      {selected ? (
        <div className="master-detail-detail">
          <div className="master-detail-back">
            <IconButton label="Back" icon={<img src={backIcon} alt="" />} onClick={onBack} />
          </div>
          {detail}
        </div>
      ) : null}
    </div>
  );
}
