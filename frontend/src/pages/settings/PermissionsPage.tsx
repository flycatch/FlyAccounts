import { useEffect, useMemo, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { EntityCard } from "../../components/EntityCard";
import "../../components/settings.css";

type Permission = components["schemas"]["Permission"];

export function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    void apiClient.GET("/permissions").then((result) => {
      if (result.data) {
        setPermissions(result.data.permissions);
      }
    });
  }, []);

  const grouped = useMemo(() => {
    const groups = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const rows = groups.get(permission.module) ?? [];
      rows.push(permission);
      groups.set(permission.module, rows);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [permissions]);

  return (
    <section className="settings-page permissions-page">
      <p className="settings-subtitle">
        Read-only catalog grouped by module. Permission types cannot be created here.
      </p>
      <div className="settings-module-list">
        {grouped.map(([module, rows]) => (
          <section key={module}>
            <h2 className="settings-module-heading">{module}</h2>
            <div className="settings-permission-grid">
              {rows.map((permission) => (
                <EntityCard key={permission.id} title={permission.name}>
                  {permission.description ? (
                    <p className="permission-card-description">{permission.description}</p>
                  ) : null}
                  <dl className="permission-card-fields">
                    <div className="permission-card-field">
                      <dt>Module</dt>
                      <dd className="permission-card-module">{permission.module}</dd>
                    </div>
                    <div className="permission-card-field">
                      <dt>Action</dt>
                      <dd className="permission-card-action">
                        {permission.action ? permission.action : "Whole-module grant"}
                      </dd>
                    </div>
                    <div className="permission-card-field">
                      <dt>Code</dt>
                      <dd className="permission-card-code">{permission.code}</dd>
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
