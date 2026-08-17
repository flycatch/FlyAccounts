import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../src/api/client", () => ({
  apiClient: {
    GET: vi.fn(() => new Promise(() => undefined)),
  },
}));

import { CombinedLandingPage } from "../src/pages/CombinedLandingPage";

const baseMe = {
  id: "00000000-0000-0000-0000-000000000002",
  displayName: "Alex Example",
  upn: "alex@contoso.com",
  roles: [
    { id: "role-finance", name: "Finance User" },
    { id: "role-hr", name: "HR User" },
  ],
  permissions: ["view_sensitive_financial_fields", "finance_landing", "hr_landing"],
  landing: {
    accessState: "authorized" as const,
    sections: [
      { code: "finance_landing", title: "Finance", body: "Content allowed by finance_landing." },
      { code: "hr_landing", title: "HR", body: "Content allowed by hr_landing." },
    ],
    sensitiveFinancialFields: { cost: "1000.00", margin: "250.00" },
  },
};

describe("CombinedLandingPage", () => {
  it("lists name and every assigned role and only returned sections", () => {
    render(<CombinedLandingPage me={baseMe} onSignedOut={() => undefined} />);
    expect(screen.getByText("Alex Example")).toBeInTheDocument();
    expect(screen.getByText("Finance User")).toBeInTheDocument();
    expect(screen.getByText("HR User")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("HR")).toBeInTheDocument();
    expect(screen.queryByText("PMO")).not.toBeInTheDocument();
    expect(screen.getByText("Cost: 1000.00")).toBeInTheDocument();
    expect(screen.getByText("Margin: 250.00")).toBeInTheDocument();
  });

  it("lists every assigned role after invited sign-in and omits unpermitted sections", () => {
    render(<CombinedLandingPage me={baseMe} onSignedOut={() => undefined} />);
    expect(screen.getByText("Finance User")).toBeInTheDocument();
    expect(screen.getByText("HR User")).toBeInTheDocument();
    expect(screen.queryByText("PMO User")).not.toBeInTheDocument();
    expect(screen.queryByText("PMO")).not.toBeInTheDocument();
  });

  it("does not invent cost and margin when the payload omits them", () => {
    const me = {
      ...baseMe,
      permissions: ["hr_landing"],
      roles: [{ id: "role-hr", name: "HR User" }],
      landing: {
        accessState: "authorized" as const,
        sections: [{ code: "hr_landing", title: "HR", body: "Content allowed by hr_landing." }],
      },
    };
    render(<CombinedLandingPage me={me} onSignedOut={() => undefined} />);
    expect(screen.queryByText(/cost:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/margin:/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Finance")).not.toBeInTheDocument();
  });
});
