
import { useState, type FormEvent } from "react";
import { loginUser, registerUser } from "../api/auth";

type AuthPageProps = {
  onLogin: (token: string) => void;
};

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        await registerUser(email, password);

        setMessage("Account created! Please log in.");
        setMode("login");
        setPassword("");
      } else {
        const result = await loginUser(email, password);
        onLogin(result.access_token);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setMessage("");
    setPassword("");
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>AP</div>

        <h1 style={styles.title}>ApplyPilot Lite</h1>

        <p style={styles.subtitle}>
          Track your job applications in one place.
        </p>

        <div style={styles.tabs}>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
            style={{
              ...styles.tab,
              ...(mode === "login" ? styles.activeTab : {}),
            }}
          >
            Log In
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
              setMessage("");
            }}
            style={{
              ...styles.tab,
              ...(mode === "register" ? styles.activeTab : {}),
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label htmlFor="email" style={styles.label}>
            Email address
          </label>

          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={styles.input}
          />

          <label htmlFor="password" style={styles.label}>
            Password
          </label>

          <input
            id="password"
            type="password"
            placeholder={
              mode === "register"
                ? "At least 8 characters"
                : "Enter your password"
            }
            autoComplete={
              mode === "register"
                ? "new-password"
                : "current-password"
            }
            minLength={mode === "register" ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={styles.input}
          />

          {error && (
            <p role="alert" style={styles.error}>
              {error}
            </p>
          )}

          {message && (
            <p role="status" style={styles.success}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </button>
        </form>

        <p style={styles.footer}>
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={switchMode}
            style={styles.linkButton}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f6fb",
    padding: "24px",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#ffffff",
    borderRadius: "16px",
    padding: "36px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
    boxSizing: "border-box",
  },
  logo: {
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: "20px",
    margin: "0 auto 18px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 750,
    textAlign: "center",
    color: "#111827",
    margin: "0 0 8px",
  },
  subtitle: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: "14px",
    margin: "0 0 28px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
  },
  tab: {
    flex: 1,
    padding: "11px",
    border: "none",
    borderRadius: "8px",
    background: "#f3f4f6",
    color: "#374151",
    fontWeight: 600,
    cursor: "pointer",
  },
  activeTab: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  label: {
    color: "#374151",
    fontSize: "14px",
    fontWeight: 600,
  },
  input: {
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    outlineColor: "#2563eb",
  },
  submitButton: {
    marginTop: "14px",
    padding: "13px",
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  error: {
    color: "#b91c1c",
    background: "#fef2f2",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "13px",
    margin: 0,
  },
  success: {
    color: "#166534",
    background: "#f0fdf4",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "13px",
    margin: 0,
  },
  footer: {
    marginTop: "24px",
    textAlign: "center",
    color: "#6b7280",
    fontSize: "14px",
  },
  linkButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
  },
};
