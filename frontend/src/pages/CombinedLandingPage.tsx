import type { components } from "../api/schema";
import { StatusPage } from "./StatusPage";
import "./CombinedLandingPage.css";

type MeResponse = components["schemas"]["MeResponse"];

type CombinedLandingPageProps = {
  me: MeResponse;
};

export function CombinedLandingPage({ me }: CombinedLandingPageProps) {
  const sensitive = me.landing.sensitiveFinancialFields;

  return (
    <section className="combined-landing-page">
      <p className="landing-welcome">{me.displayName}</p>
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
