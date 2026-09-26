import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { Identity, ExpertQuestionItem, Message, STATUS_LABELS_RU } from "../types";
import { RoleBadge } from "../components/RoleBadge";
import { connectSocket, disconnectSocket } from "../socket";

interface QueueResponse {
  unclaimed: ExpertQuestionItem[];
  mine: ExpertQuestionItem[];
}

interface ThreadDetail extends ExpertQuestionItem {
  messages: Message[];
}

const POLL_MS = 8000;

export function ExpertInbox({ user }: { user: Extract<Identity, { kind: "staff" }> }) {
  const [queue, setQueue] = useState<QueueResponse>({ unclaimed: [], mine: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadQueue = useCallback(async () => {
    try {
      const data = await api.get<QueueResponse>("/api/questions/queue");
      setQueue(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const data = await api.get<ThreadDetail>(`/api/questions/${id}`);
      setThread(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!user.isAnswerer) return;
    loadQueue();
    const socket = connectSocket();
    const refresh = () => {
      loadQueue();
      if (selectedIdRef.current) loadThread(selectedIdRef.current);
    };
    socket.on("question:new", refresh);
    socket.on("question:claimed", refresh);
    socket.on("question:message", refresh);
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      clearInterval(interval);
      socket.off("question:new", refresh);
      socket.off("question:claimed", refresh);
      socket.off("question:message", refresh);
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.isAnswerer]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId, loadThread]);

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

  return (
    <div className="my-questions">
      <aside className="my-questions__list">
        <div className="panel__header" style={{ marginBottom: 8 }}>
          <RoleBadge role={user.role} />
          <span className="muted small">{user.aura} ауры</span>
        </div>
        {error && <p className="error-text">{error}</p>}

        <h3>Новые ({queue.unclaimed.length})</h3>
        {queue.unclaimed.length === 0 && <p className="muted small">Нет новых вопросов в ваших категориях.</p>}
        {queue.unclaimed.map((q) => (
          <button key={q.id} className={`question-list-item ${q.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(q.id)}>
            <span className="question-list-item__category">{q.category?.title}</span>
            <span className="question-list-item__text">{q.text}</span>
            <span className="muted small">от {q.studentName}</span>
          </button>
        ))}

        <h3>В работе у вас ({queue.mine.length})</h3>
        {queue.mine.length === 0 && <p className="muted small">Пока нет вопросов в работе.</p>}
        {queue.mine.map((q) => (
          <button key={q.id} className={`question-list-item ${q.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(q.id)}>
            <span className="question-list-item__category">{q.category?.title}</span>
            <span className="question-list-item__text">{q.text}</span>
            <span className={`status-badge status-badge--${q.status.toLowerCase()}`}>{STATUS_LABELS_RU[q.status]}</span>
          </button>
        ))}
      </aside>

      <section className="panel my-questions__thread">
        {thread ? (
          <ExpertThreadView thread={thread} onClaimed={loadQueue} onChanged={() => { loadThread(thread.id); loadQueue(); }} />
        ) : (
          <p className="muted">Выберите вопрос слева.</p>
        )}
      </section>
    </div>
  );
}

function ExpertThreadView({
  thread,
  onClaimed,
  onChanged,
}: {
  thread: ThreadDetail;
  onClaimed: () => void;
  onChanged: () => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isClosed = thread.status === "CLOSED";
  const isClaimed = !!thread.assignedTo;

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/questions/${thread.id}/claim`);
      onClaimed();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/questions/${thread.id}/messages`, { text: reply.trim() });
      setReply("");
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
          <p className="muted small">от {thread.studentName}</p>
        </div>
        <span className={`status-badge status-badge--${thread.status.toLowerCase()}`}>{STATUS_LABELS_RU[thread.status]}</span>
      </div>

      {!!thread.isSensitive && <p className="question-card__flag">Конфиденциальная тема</p>}

      <div className="chat-window chat-window--thread">
        <div className="chat-bubble chat-bubble--me">
          <p style={{ whiteSpace: "pre-wrap" }}>{thread.text}</p>
        </div>
        {thread.messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.senderType === "EXPERT" ? "chat-bubble--expert" : "chat-bubble--me"}`}>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}

      {isClosed ? (
        <p className="muted small">Студент закрыл этот вопрос — переписка недоступна.</p>
      ) : !isClaimed ? (
        <button onClick={claim} disabled={busy}>
          Взять в работу
        </button>
      ) : (
        <div className="chat-input">
          <input
            placeholder="Введите ответ…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendReply()}
          />
          <button onClick={sendReply} disabled={busy || !reply.trim()}>
            Отправить
          </button>
        </div>
      )}
    </div>
  );
}
