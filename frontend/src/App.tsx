import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { Identity } from "./types";
import { api, getToken, setToken } from "./api";
import { Login } from "./pages/Login";
import { StudentHome } from "./pages/StudentHome";
import { AskQuestion } from "./pages/AskQuestion";
import { MyQuestions } from "./pages/MyQuestions";
import { ExpertInbox } from "./pages/ExpertInbox";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Leaderboard } from "./pages/Leaderboard";

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecked(true);
      return;
    }
    api
      .get<Identity>("/api/auth/whoami")
      .then(setIdentity)
      .catch(() => {
        setToken(null);
        setIdentity(null);
      })
      .finally(() => setChecked(true));
  }, []);

  function logout() {
    setToken(null);
    setIdentity(null);
    navigate("/");
  }

  if (!checked) return null;

  const isStudent = identity?.kind === "student";
  const isStaff = identity?.kind === "staff";

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          AskVUZ
        </Link>
        <nav>
          <Link to="/leaderboard">Рейтинг</Link>
          {isStudent && <Link to="/ask">Задать вопрос</Link>}
          {isStudent && <Link to="/my-questions">Мои вопросы</Link>}
          {isStaff && identity.isAnswerer && <Link to="/expert">Мои вопросы</Link>}
          {isStaff && (identity.isUniversityAdmin || identity.isPlatformAdmin) && <Link to="/admin">Админ-панель</Link>}
        </nav>
        <div className="app-header__right">
          {identity ? (
            <>
              <span className="muted">{identity.displayName}</span>
              <button onClick={logout}>Выйти</button>
            </>
          ) : (
            <Link to="/login" className="staff-login-link">
              Войти
            </Link>
          )}
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<StudentHome identity={identity} onLoggedIn={setIdentity} />} />
          <Route
            path="/ask"
            element={isStudent ? <AskQuestion /> : <Navigate to="/" replace />}
          />
          <Route
            path="/my-questions"
            element={isStudent ? <MyQuestions /> : <Navigate to="/" replace />}
          />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/login" element={<Login onLoggedIn={setIdentity} />} />
          <Route path="/expert" element={isStaff ? <ExpertInbox user={identity} /> : <Navigate to="/login" replace />} />
          <Route path="/admin" element={isStaff ? <AdminDashboard user={identity} /> : <Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}
