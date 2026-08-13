import { useEffect, useState } from "react";

import { apiClient } from "../api/client";
import "./StatusPage.css";

type ConnectionStatus = "loading" | "connected" | "not_connected";
type Reachability = "ok" | "unavailable";

export function StatusPage() {
  const [connection, setConnection] = useState<ConnectionStatus>("loading");
  const [database, setDatabase] = useState<Reachability | null>(null);
  const [storage, setStorage] = useState<Reachability | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .GET("/status")
      .then(({ data, error, response }) => {
        if (cancelled) {
          return;
        }
        if (error || !response.ok || !data) {
          setConnection("not_connected");
          setDatabase(null);
          setStorage(null);
          return;
        }
        setConnection("connected");
        setDatabase(data.database);
        setStorage(data.storage);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setConnection("not_connected");
        setDatabase(null);
        setStorage(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="status-page">
      <h1>FlyAccounts</h1>
      <p>The application is working.</p>
      {connection === "loading" ? <p>Checking connection…</p> : null}
      {connection === "connected" ? (
        <>
          <p>The application is connected successfully.</p>
          {database ? <p>Database: {database}</p> : null}
          {storage ? <p>Storage: {storage}</p> : null}
        </>
      ) : null}
      {connection === "not_connected" ? (
        <p>The application is not connected.</p>
      ) : null}
    </main>
  );
}
