import { useState, type FormEvent } from "react";

import { loginUser, registerUser } from "../api/auth";
import { getErrorMessage } from "../utils";
import {
  AlertIcon,
  BriefcaseIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LogoMark,
  ShieldIcon,
  SparklesIcon,
} from "./Icons";
import Spinner from "./Spinner";

type AuthPageProps = {
  onLogin: (token: string) => void;
  // True while the app verifies the token after a successful login
  verifying: boolean;
  // Message from the app, e.g. an expired session
  notice: string;
};

const FEATURES = [
  {
    icon: <BriefcaseIcon size={18} />,
    title: "Every application in one place",
    text: "Track companies, roles, statuses and notes without spreadsheets.",
  },
  {
    icon: <SparklesIcon size={18} />,
    title: "AI resume matching",
    text: "See how your resume fits a job and what to improve before applying.",
  },
  {
    icon: <ShieldIcon size={18} />,
    title: "Private by default",
    text: "Your applications are only visible to your account.",
  },
];

export default function AuthPage({
  onLogin,
  verifying,
  notice,
}: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isRegister = mode === "register";
  const busy = loading || verifying;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isRegister) {
        await registerUser(email, password);

        setMessage("Account created. Log in to get started.");
        setMode("login");
        setPassword("");
      } else {
        const result = await loginUser(email, password);
        onLogin(result.access_token);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
  }

  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="brand">
            <LogoMark size={32} />
            <span className="brand-name">
              ApplyPilot <span className="brand-tag">AI</span>
            </span>
          </div>

          <div>
            <h2 className="auth-brand-title">
              Run your job search like a project.
            </h2>
            <p className="auth-brand-text">
              ApplyPilot AI keeps your applications organized and uses AI to
              help you tailor your resume for every role.
            </p>
          </div>

          <ul className="auth-features">
            {FEATURES.map((feature) => (
              <li key={feature.title}>
                <span className="auth-feature-icon">{feature.icon}</span>
                <div>
                  <p className="auth-feature-title">{feature.title}</p>
                  <p className="auth-feature-text">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="brand auth-mobile-brand">
            <LogoMark size={32} />
            <span className="brand-name">
              ApplyPilot <span className="brand-tag">AI</span>
            </span>
          </div>

          <h1 className="auth-title">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="auth-subtitle">
            {isRegister
              ? "Start tracking your applications in minutes."
              : "Log in to continue to your dashboard."}
          </p>

          <div className="segmented" role="group" aria-label="Account">
            <button
              type="button"
              aria-pressed={!isRegister}
              onClick={() => changeMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              aria-pressed={isRegister}
              onClick={() => changeMode("register")}
            >
              Sign up
            </button>
          </div>

          {notice && !error && !message && (
            <div className="alert alert-info" role="status">
              <AlertIcon />
              <span>{notice}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input input-large"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  className="input input-large"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    isRegister ? "At least 8 characters" : "Your password"
                  }
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  minLength={isRegister ? 8 : undefined}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={isRegister ? "password-hint" : undefined}
                  required
                />
                <button
                  type="button"
                  className="icon-button password-toggle"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {isRegister && (
                <span
                  id="password-hint"
                  className={`field-hint ${password.length >= 8 ? "field-hint-ok" : ""}`}
                >
                  {password.length >= 8 && <CheckIcon size={12} />}
                  Use at least 8 characters.
                </span>
              )}
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="alert alert-success" role="status">
                <CheckIcon />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              className="button button-primary button-block button-large"
              disabled={busy}
            >
              {busy && <Spinner />}
              {verifying
                ? "Signing in..."
                : loading
                  ? "Please wait..."
                  : isRegister
                    ? "Create account"
                    : "Log in"}
            </button>
          </form>

          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to ApplyPilot AI?"}{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => changeMode(isRegister ? "login" : "register")}
            >
              {isRegister ? "Log in" : "Create an account"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
