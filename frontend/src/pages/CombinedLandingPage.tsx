import type { components } from "../api/schema";
import { signOut } from "../auth/tokens";
import { StatusPage } from "./StatusPage";
import "./CombinedLandingPage.css";

type MeResponse = components["schemas"]["MeResponse"];

type CombinedLandingPageProps = {
  me: MeResponse;
  onSignedOut: () => void;
};

export function CombinedLandingPage({ me, onSignedOut }: CombinedLandingPageProps) {
  const sensitive = me.landing.sensitiveFinancialFields;

  async function handleSignOut() {
    await signOut();
    onSignedOut();
  }

  return (
    <section className="app-page combined-landing-page">
      <header className="landing-header">
        <div>
          <h1>FlyAccounts</h1>
          <p>{me.displayName}</p>
        </div>
        <div className="landing-actions">
          <button type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </header>
      <section>
        <h2>Assigned roles</h2>
        {me.roles.length === 0 ? (
          <p>No roles assigned.</p>
        ) : (
          <ul>
            {me.roles.map((role) => (
              <li key={role.id}>{role.name}</li>
            ))}
          </ul>
        )}
      </section>
      {me.landing.sections.map((section) => (
        <section key={section.code}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
      {sensitive ? (
        <section>
          <h2>Sensitive financial fields</h2>
          <p>Cost: {sensitive.cost}</p>
          <p>Margin: {sensitive.margin}</p>
        </section>
      ) : null}
      <StatusPage />
    </section>
  );
}
