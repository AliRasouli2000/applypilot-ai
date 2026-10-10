
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("Connecting...");
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    async function checkBackend() {
      try {
        const [homeResponse, healthResponse] = await Promise.all([
          fetch("http://localhost:8000/"),
          fetch("http://localhost:8000/health"),
        ]);

        if (!homeResponse.ok || !healthResponse.ok) {
          throw new Error("Backend request failed");
        }

        const homeData = await homeResponse.json();
        const healthData = await healthResponse.json();

        setMessage(homeData.message);
        setStatus(healthData.status);
      } catch (error) {
        console.error(error);
        setMessage("Unable to connect to backend");
        setStatus("Offline");
      }
    }

    checkBackend();
  }, []);

  return (
    <main className="app">
      <h1>ApplyPilot Lite</h1>
      <p>Your AI-powered job application tracker</p>

      <section className="status-card">
        <h2>Backend Connection</h2>
        <p>{message}</p>
        <p>
          Status: <strong>{status}</strong>
        </p>
      </section>
    </main>
  );
}

export default App;
