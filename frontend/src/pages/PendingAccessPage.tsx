import { signOut } from "../auth/tokens";
import "./PendingAccessPage.css";

type PendingAccessPageProps = {
  onSignedOut: () => void;
};

export function PendingAccessPage({ onSignedOut }: PendingAccessPageProps) {
  async function handleSignOut() {
    await signOut();
    onSignedOut();
  }

  return (
    <main className="app-page pending-access-page">
      <h1>FlyAccounts</h1>
      <p>Your access is pending. A recognized role has not been assigned yet.</p>
      <button type="button" onClick={() => void handleSignOut()}>
        Sign out
      </button>
    </main>
  );
}
