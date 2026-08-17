import { useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { EntityCard } from "../../components/EntityCard";
import "../../components/settings.css";

type Permission = components["schemas"]["Permission"];
type PermissionModuleGroup = components["schemas"]["PermissionModuleGroup"];

export function PermissionsPage() {
  const [modules, setModules] = useState<PermissionModuleGroup[]>([]);

  useEffect(() => {
    void apiClient.GET("/permissions").then((result) => {
      if (result.data) {
        setModules(result.data.modules);
      }
    });
  }, []);

  return (
    <section className="settings-page permissions-page">
      <p className="settings-subtitle">
        Read-only catalog grouped by module. Permission types cannot be created here.
      </p>
      <div className="settings-module-list">
        {modules.map((group) => (
          <section key={group.module}>
            <h2 className="settings-module-heading">{group.module}</h2>
            <div className="settings-permission-grid">
              {group.permissions.map((permission: Permission) => (
                <EntityCard key={permission.id} title={permission.name}>
                  {permission.description ? (
                    <p className="permission-card-description">{permission.description}</p>
                  ) : null}
                  <dl className="permission-card-fields">
                    <div className="permission-card-field">
                      <dt>Permission</dt>
                      <dd className="permission-card-code">{permission.permission}</dd>
                    </div>
                  </dl>
                </EntityCard>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
