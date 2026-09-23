import { useState } from "react";
import { QuestionItem } from "../types";
import { api } from "../api";

export function QuestionCard({ question, onChanged }: { question: QuestionItem; onChanged: () => void }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/questions/${question.id}/claim`);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/questions/${question.id}/answers`, { text: answer.trim() });
      setAnswer("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`question-card ${question.isSensitive ? "sensitive" : ""}`}>
      <div className="question-card__meta">
        <span className="question-card__category">{question.category?.title}</span>
        {!!question.isSensitive && <span className="question-card__flag">конфиденциально</span>}
        <span className="question-card__time">{new Date(question.createdAt).toLocaleString("ru-RU")}</span>
      </div>
      <p className="question-card__text">{question.text}</p>
      <p className="question-card__asker">от: {question.askerName || "Гость"}</p>

      {question.status === "PENDING" || question.status === "ESCALATED" ? (
        <button disabled={busy} onClick={claim}>
          Взять в работу
        </button>
      ) : (
        <div className="question-card__answer-form">
          <textarea
            placeholder="Введите ответ…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={3}
          />
          <button disabled={busy || !answer.trim()} onClick={submitAnswer}>
            Отправить ответ
          </button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
