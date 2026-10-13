import { useCallback, useState } from "react";

import "./App.css";

import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import ResumeMatcher from "./components/ResumeMatcher";
import {
  BriefcaseIcon,
  LogOutIcon,
  LogoMark,
  SparklesIcon,
} from "./components/Icons";

import { getCurrentUser, type AuthUser } from "./api/auth";

type View = "applications" | "matcher";

const NAV_ITEMS: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "applications", label: "Applications", icon: <BriefcaseIcon /> },
  { view: "matcher", label: "Resume Matcher", icon: <SparklesIcon /> },
];

type AppShellProps = {
  token: string;
  user: AuthUser;
  onLogout: () => void;
  onSessionExpired: () => void;
};

function AppShell({ token, user, onLogout, onSessionExpired }: AppShellProps) {
  const [view, setView] = useState<View>("applications");

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <LogoMark size={26} />
            <span className="brand-name">
              ApplyPilot <span className="brand-tag">Lite</span>
            </span>
          </div>

          <nav className="nav" aria-label="Main">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                type="button"
                className="nav-item"
                aria-current={view === item.view ? "page" : undefined}
                onClick={() => setView(item.view)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="user-menu">
            <span className="avatar" aria-hidden="true">
              {user.email.charAt(0).toUpperCase()}
            </span>
            <span className="user-email" title={user.email}>
              {user.email}
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOutIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Both views stay mounted so their state survives tab switches */}
      <main className="page">
        <div hidden={view !== "applications"}>
          <Dashboard token={token} onSessionExpired={onSessionExpired} />
        </div>
        <div hidden={view !== "matcher"}>
          <ResumeMatcher token={token} onSessionExpired={onSessionExpired} />
        </div>
      </main>
    </div>
  );
}

function App() {
  // Tokens are kept in memory, not localStorage.
  // Refreshing the page requires logging in again.
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState("");

  const handleLogout = useCallback(() => {
    setToken(null);
    setUser(null);
    setNotice("");
  }, []);

  const handleSessionExpired = useCallback(() => {
    setToken(null);
    setUser(null);
    setNotice("Your session has expired. Please log in again.");
  }, []);

  async function handleLogin(accessToken: string) {
    setVerifying(true);
    setNotice("");

    try {
      const profile = await getCurrentUser(accessToken);

      setUser(profile);
      setToken(accessToken);
    } catch {
      setNotice("We couldn't verify your login. Please try again.");
      setToken(null);
      setUser(null);
    } finally {
      setVerifying(false);
    }
  }

  if (token && user) {
    return (
      <AppShell
        token={token}
        user={user}
        onLogout={handleLogout}
        onSessionExpired={handleSessionExpired}
      />
    );
  }

  return (
    <AuthPage
      verifying={verifying}
      notice={notice}
      onLogin={(accessToken) => {
        void handleLogin(accessToken);
      }}
    />
  );
}

export default App;
