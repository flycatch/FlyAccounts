import { useEffect, useState } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import "./AccessAdminPage.css";

type Person = components["schemas"]["Person"];
type RoleSummary = components["schemas"]["RoleSummary"];

type AccessAdminPageProps = {
  onBack: () => void;
};

export function AccessAdminPage({ onBack }: AccessAdminPageProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [peopleResult, rolesResult] = await Promise.all([
      apiClient.GET("/people"),
      apiClient.GET("/roles"),
    ]);
    if (peopleResult.data) {
      setPeople(peopleResult.data.people);
    }
    if (rolesResult.data) {
      setRoles(rolesResult.data.roles);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function errorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === "object" && "code" in payload) {
      const code = (payload as { code: string }).code;
      if (code === "duplicate_assignment") {
        return "That role is already assigned.";
      }
      if (code === "last_admin_required") {
        return "At least one person with access administration must remain.";
      }
    }
    return fallback;
  }

  async function handleAssign() {
    setError(null);
    setMessage(null);
    if (!selectedUserId || !selectedRoleId) {
      setError("Choose a person and a role to assign.");
      return;
    }
    const { data, error: apiError } = await apiClient.POST("/people/{userId}/roles", {
      params: { path: { userId: selectedUserId } },
      body: { roleId: selectedRoleId },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The role could not be assigned."));
      return;
    }
    setMessage("Role assigned.");
    await load();
  }

  async function handleRevoke(userId: string, roleId: string) {
    setError(null);
    setMessage(null);
    const { data, error: apiError } = await apiClient.DELETE("/people/{userId}/roles/{roleId}", {
      params: { path: { userId, roleId } },
    });
    if (apiError || !data) {
      setError(errorMessage(apiError, "The role could not be revoked."));
      return;
    }
    setMessage("Role revoked.");
    await load();
  }

  return (
    <main className="app-page access-admin-page">
      <header className="landing-header">
        <h1>Access administration</h1>
        <button type="button" onClick={onBack}>
          Back to landing
        </button>
      </header>
      <form
        className="assign-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleAssign();
        }}
      >
        <label>
          Person
          <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
            <option value="">Select a person</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName} ({person.upn})
              </option>
            ))}
          </select>
        </label>
        <label>
          Role
          <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
            <option value="">Select a role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Assign role</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      <section>
        <h2>People</h2>
        {people.map((person) => (
          <article key={person.id} className="person-card">
            <h3>{person.displayName}</h3>
            <p>{person.upn}</p>
            {person.roles.length === 0 ? <p>No roles assigned.</p> : null}
            <ul>
              {person.roles.map((role) => (
                <li key={role.id}>
                  <span>{role.name}</span>
                  <button type="button" onClick={() => void handleRevoke(person.id, role.id)}>
                    Revoke {role.name}
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
