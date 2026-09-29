import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface Button {
  id: string;
  label: string;
}
interface ChatMessage {
  id: string;
  from: "bot" | "me";
  text: string;
  buttons?: Button[];
}
interface WizardReply {
  text: string;
  buttons?: Button[];
  questionId?: string;
  done?: boolean;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function AskQuestion() {
  const [wizardId, setWizardId] = useState(randomId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    start();
  }, [wizardId]);

  async function start() {
    setMessages([]);
    setDone(null);
    const reply = await api.post<WizardReply>("/api/student/ask/start", { wizardId });
    setMessages([{ id: "start", from: "bot", text: reply.text, buttons: reply.buttons }]);
  }

  async function click(button: Button) {
    setMessages((prev) => [...prev, { id: `me-${Date.now()}`, from: "me", text: button.label }]);
    const reply = await api.post<WizardReply>("/api/student/ask/click", { wizardId, buttonId: button.id });
    applyReply(reply);
  }

  async function send() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: `me-${Date.now()}`, from: "me", text }]);
    const reply = await api.post<WizardReply>("/api/student/ask/message", { wizardId, text });
    applyReply(reply);
  }

  function applyReply(reply: WizardReply) {
    setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, from: "bot", text: reply.text, buttons: reply.buttons }]);
    if (reply.done && reply.questionId) setDone(reply.questionId);
  }

  function askAnother() {
    setWizardId(randomId());
  }

  return (
    <div className="panel chat-panel">
      <h2>Задать вопрос</h2>
      <div className="chat-window">
        {messages.map((m, i) => {
          const isLastBotMessage = m.from === "bot" && !messages.slice(i + 1).some((later) => later.from === "bot");
          return (
            <div key={m.id} className={`chat-bubble chat-bubble--${m.from}`}>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
              {m.buttons && (
                <div className="chat-bubble__buttons">
                  {m.buttons.map((b) =>
                    isLastBotMessage ? (
                      <button key={b.id} onClick={() => click(b)}>
                        {b.label}
                      </button>
                    ) : (
                      <button key={b.id} disabled title="Этот шаг уже пройден">
                        {b.label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {done ? (
        <div className="chat-done">
          <Link to="/my-questions">Перейти в «Мои вопросы»</Link>
          <button onClick={askAnother}>Задать ещё один вопрос</button>
        </div>
      ) : (
        <div className="chat-input">
          <input
            placeholder="Напишите сообщение…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button onClick={send}>Отправить</button>
        </div>
      )}
    </div>
  );
}
