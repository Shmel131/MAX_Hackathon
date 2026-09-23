import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { AuthUser } from "./types";
import { api, getToken, getStoredUser, setToken, setStoredUser } from "./api";
import { Login } from "./pages/Login";
import { ExpertInbox } from "./pages/ExpertInbox";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Leaderboard } from "./pages/Leaderboard";
import { ChatSimulator } from "./pages/ChatSimulator";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser<AuthUser>());
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecked(true);
      return;
    }
    api
      .get<AuthUser>("/api/auth/me")
      .then((u) => {
        setUser(u);
        setStoredUser(u);
      })
      .catch(() => {
        setToken(null);
        setStoredUser(null);
        setUser(null);
      })
      .finally(() => setChecked(true));
  }, []);

  function logout() {
    setToken(null);
    setStoredUser(null);
    setUser(null);
    navigate("/login");
  }

  if (!checked) return null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          AskVUZ
        </Link>
        <nav>
          <Link to="/simulator">Чат-симулятор</Link>
          {user && (
            <>
              {user.isAnswerer && <Link to="/expert">Мои вопросы</Link>}
              {(user.isUniversityAdmin || user.isPlatformAdmin) && <Link to="/admin">Админ-панель</Link>}
              {user.universityId && <Link to="/leaderboard">Рейтинг</Link>}
            </>
          )}
        </nav>
        <div className="app-header__right">
          {user ? (
            <>
              <span className="muted">{user.displayName}</span>
              <button onClick={logout}>Выйти</button>
            </>
          ) : (
            <Link to="/login">Войти</Link>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/simulator" replace />} />
          <Route path="/simulator" element={<ChatSimulator />} />
          <Route path="/login" element={<Login onLoggedIn={setUser} />} />
          <Route
            path="/expert"
            element={user ? <ExpertInbox user={user} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/admin"
            element={user ? <AdminDashboard user={user} /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/leaderboard"
            element={user ? <Leaderboard user={user} /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}
