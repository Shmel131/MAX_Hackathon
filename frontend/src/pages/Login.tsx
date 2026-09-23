import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken, setStoredUser } from "../api";
import { AuthUser } from "../types";

export function Login({ onLoggedIn }: { onLoggedIn: (user: AuthUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>("/api/auth/login", { email, password });
      setToken(res.token);
      setStoredUser(res.user);
      onLoggedIn(res.user);
      if (res.user.isPlatformAdmin || res.user.isUniversityAdmin) navigate("/admin");
      else navigate("/expert");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>AskVUZ — вход</h1>
        <p className="muted">Панель для экспертов и администраторов вуза.</p>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Пароль
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={busy}>
          Войти
        </button>
        <p className="muted small">
          Демо-доступ: admin@askvuz.local / admin12345 (платформенный админ) или pro@itmo.demo / demo12345 (эксперт «Профи»).
          Полный список — в README.
        </p>
      </form>
    </div>
  );
}
