import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { connectSocket, disconnectSocket } from "../socket";
import { Message, StudentQuestionSummary, STATUS_LABELS_RU } from "../types";

interface ThreadDetail extends StudentQuestionSummary {
  messages: Message[];
}

const POLL_MS = 5000;

export function MyQuestions() {
  const [list, setList] = useState<StudentQuestionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mirrors selectedId for use inside the mount-only socket effect below,
  // so the socket doesn't have to be torn down and rebuilt on every click.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadList = useCallback(async () => {
    try {
      const data = await api.get<StudentQuestionSummary[]>("/api/student/questions");
      setList(data);
      setSelectedId((current) => current ?? (data.length > 0 ? data[0].id : current));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const data = await api.get<ThreadDetail>(`/api/student/questions/${id}`);
      setThread(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Realtime push (best effort) + a polling fallback, so answers still show
  // up even if a socket reconnect is ever missed — connect once on mount,
  // never mid-session, so switching between questions never touches it.
  useEffect(() => {
    loadList();
    const socket = connectSocket();
    const onMessage = (payload: { questionId: string }) => {
      loadList();
      if (payload.questionId === selectedIdRef.current) loadThread(payload.questionId);
    };
    const onClosed = () => {
      loadList();
    };
    socket.on("question:message", onMessage);
    socket.on("question:closed", onClosed);
    const interval = setInterval(() => {
      loadList();
      if (selectedIdRef.current) loadThread(selectedIdRef.current);
    }, POLL_MS);
    return () => {
      clearInterval(interval);
      socket.off("question:message", onMessage);
      socket.off("question:closed", onClosed);
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId, loadThread]);

  return (
    <div className="my-questions">
      <aside className="my-questions__list">
        <h3>Мои вопросы</h3>
        {error && <p className="error-text">{error}</p>}
        {list.length === 0 && <p className="muted small">Вы ещё не задавали вопросов.</p>}
        {list.map((q) => (
          <button
            key={q.id}
            className={`question-list-item ${q.id === selectedId ? "active" : ""}`}
            onClick={() => setSelectedId(q.id)}
          >
            <span className="question-list-item__category">{q.category?.title}</span>
            <span className="question-list-item__text">{q.text}</span>
            <span className={`status-badge status-badge--${q.status.toLowerCase()}`}>{STATUS_LABELS_RU[q.status]}</span>
          </button>
        ))}
      </aside>

      <section className="panel my-questions__thread">
        {thread ? <ThreadView thread={thread} onChanged={() => { loadThread(thread.id); loadList(); }} /> : <p className="muted">Выберите вопрос слева.</p>}
      </section>
    </div>
  );
}

function ThreadView({ thread, onChanged }: { thread: ThreadDetail; onChanged: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExpertMessage = thread.messages.some((m) => m.senderType === "EXPERT");
  const isClosed = thread.status === "CLOSED";

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/student/questions/${thread.id}/messages`, { text: reply.trim() });
      setReply("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rate(rating: "HELPFUL" | "NOT_HELPFUL" | "RESOLVED") {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/student/questions/${thread.id}/rate`, { rating });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function closeQuestion() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/student/questions/${thread.id}/close`);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="panel__header">
        <div>
          <h3>{thread.category?.title}</h3>
          <p className="muted small">{thread.university?.name}</p>
        </div>
        <div className="thread-actions">
          <span className={`status-badge status-badge--${thread.status.toLowerCase()}`}>{STATUS_LABELS_RU[thread.status]}</span>
          {!isClosed && (
            <button className="danger-button" onClick={closeQuestion} disabled={busy}>
              Закрыть вопрос
            </button>
          )}
        </div>
      </div>

      <div className="chat-window chat-window--thread">
        <div className="chat-bubble chat-bubble--me">
          <p style={{ whiteSpace: "pre-wrap" }}>{thread.text}</p>
        </div>
        {thread.messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.senderType === "STUDENT" ? "chat-bubble--me" : "chat-bubble--expert"}`}>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {hasExpertMessage && !thread.askerRating && !isClosed && (
        <div className="rate-row">
          <span>Оцените ответ:</span>
          <button onClick={() => rate("RESOLVED")} disabled={busy}>
            Решило вопрос ✅
          </button>
          <button onClick={() => rate("HELPFUL")} disabled={busy}>
            Помогло 👍
          </button>
          <button onClick={() => rate("NOT_HELPFUL")} disabled={busy}>
            Не помогло 👎
          </button>
        </div>
      )}
      {thread.askerRating && <p className="muted small">Вы уже оценили этот ответ.</p>}

      {!isClosed ? (
        <div className="chat-input">
          <input
            placeholder="Уточняющий вопрос специалисту…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendReply()}
          />
          <button onClick={sendReply} disabled={busy || !reply.trim()}>
            Отправить
          </button>
        </div>
      ) : (
        <p className="muted small">Вопрос закрыт — переписка недоступна.</p>
      )}
    </div>
  );
}
