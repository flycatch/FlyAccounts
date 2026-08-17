import { useEffect, useMemo, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import "../settings/UsersPage.css";
import "./PermissionsPage.css";

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
      <p className="settings-subtitle">Read-only catalog grouped by module. Permission types cannot be created here.</p>
      <div className="settings-module-list">
        {grouped.map(([module, rows]) => (
          <article key={module} className="settings-card">
            <div className="settings-card-header">
              <h2 className="settings-card-title">{module}</h2>
            </div>
            <div className="settings-card-body">
              {rows.map((permission) => (
                <div key={permission.id} className="settings-row">
                  <div>
                    <p>{permission.name}</p>
                    <p>{permission.code}</p>
                    {permission.action ? <p>{permission.action}</p> : <p>Whole-module grant</p>}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
