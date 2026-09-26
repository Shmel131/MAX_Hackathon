import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken } from "../api";
import { Identity } from "../types";

interface Props {
  identity: Identity | null;
  onLoggedIn: (identity: Identity) => void;
}

export function StudentHome({ identity, onLoggedIn }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ token: string; student: { id: string; displayName: string } }>("/api/student/login", {
        displayName: name.trim(),
      });
      setToken(res.token);
      onLoggedIn({ kind: "student", id: res.student.id, displayName: res.student.displayName });
      navigate("/ask");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (identity?.kind === "staff") {
    return (
      <div className="panel">
        <h2>Вы вошли как сотрудник вуза</h2>
        <p className="muted">
          Эта главная страница — режим студента. Чтобы отвечать на вопросы или управлять вузом, перейдите в{" "}
          <Link to="/expert">«Мои вопросы»</Link> или <Link to="/admin">«Админ-панель»</Link>.
        </p>
      </div>
    );
  }

  if (identity?.kind === "student") {
    return (
      <div className="panel student-home">
        <h2>Здравствуйте, {identity.displayName}!</h2>
        <p className="muted">Быстрый ответ от вашего вуза в реальном времени.</p>
        <div className="student-home__actions">
          <Link to="/ask" className="big-action">
            Задать вопрос
          </Link>
          <Link to="/my-questions" className="big-action big-action--secondary">
            Мои вопросы
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="panel student-home">
      <h2>Добро пожаловать в AskVUZ</h2>
      <p className="muted">
        Выберите вуз, задайте вопрос — и получите ответ от специалиста в реальном времени. Для начала представьтесь:
      </p>
      <form className="auth-card auth-card--inline" onSubmit={login}>
        <label>
          Ваше имя
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Олеся" required autoFocus />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={busy}>
          Продолжить
        </button>
        <p className="muted small">
          В MVP достаточно имени — оно закрепляет за вами историю вопросов в этом браузере. В полной версии продукта
          вход будет по логину/паролю, а вуз задаётся один раз при регистрации.
        </p>
      </form>
    </div>
  );
}
