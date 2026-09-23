import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { AuthUser, QuestionItem } from "../types";
import { QuestionCard } from "../components/QuestionCard";
import { RoleBadge } from "../components/RoleBadge";
import { connectExpertSocket, disconnectExpertSocket } from "../socket";

const POLL_MS = 8000;

export function ExpertInbox({ user }: { user: AuthUser }) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<QuestionItem[]>("/api/questions/queue");
      setQuestions(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const socket = connectExpertSocket();
    socket.on("question:new", load);
    socket.on("question:claimed", load);
    const interval = setInterval(load, POLL_MS);
    return () => {
      clearInterval(interval);
      socket.off("question:new", load);
      socket.off("question:claimed", load);
      disconnectExpertSocket();
    };
  }, [load]);

  if (!user.isAnswerer) {
    return (
      <div className="panel">
        <p>
          Ваш аккаунт не имеет права отвечать на вопросы. Обратитесь к администратору вуза, чтобы получить роль
          отвечающего.
        </p>
      </div>
    );
  }

  const pending = questions.filter((q) => q.status === "PENDING" || q.status === "ESCALATED");
  const mine = questions.filter((q) => (q as any).assignedToId === user.id);

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Очередь вопросов</h2>
        <div>
          <RoleBadge role={user.role} /> <span className="muted">{user.reputationPoints} баллов репутации</span>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}

      <h3>Новые ({pending.length})</h3>
      {pending.length === 0 && <p className="muted">Пока нет новых вопросов в ваших категориях.</p>}
      {pending.map((q) => (
        <QuestionCard key={q.id} question={q} onChanged={load} />
      ))}

      {mine.length > 0 && (
        <>
          <h3>В работе у вас ({mine.length})</h3>
          {mine.map((q) => (
            <QuestionCard key={q.id} question={q} onChanged={load} />
          ))}
        </>
      )}
    </div>
  );
}
