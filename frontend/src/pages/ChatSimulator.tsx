import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { openSimulatorSocket } from "../socket";

interface Button {
  id: string;
  label: string;
}
interface ChatMessage {
  id: string;
  from: "bot" | "me" | "expert";
  text: string;
  buttons?: Button[];
}

function randomChatId() {
  return `sim-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Browser stand-in for the real MAX chat-bot experience. It talks to the
 * exact same conversation engine as the MAX webhook (see backend
 * src/conversation/engine.ts) — this view exists so the primary user
 * scenario can be reviewed without a live MAX bot token. See README
 * "Как проверить без токена МАХ".
 */
export function ChatSimulator() {
  const [chatId] = useState(randomChatId);
  const [name, setName] = useState("Тестовый студент");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingRatings, setPendingRatings] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const socket = openSimulatorSocket(chatId);
    socket.on("question:answered", (payload: { answerId: string; text: string; responder: { displayName: string } }) => {
      setMessages((prev) => [
        ...prev,
        { id: `ans-${payload.answerId}`, from: "expert", text: `${payload.responder.displayName}:\n${payload.text}` },
      ]);
      setPendingRatings((p) => ({ ...p, [payload.answerId]: true }));
    });
    return () => {
      socket.disconnect();
    };
  }, [chatId]);

  async function start() {
    const reply = await api.post<{ text: string; buttons?: Button[] }>("/api/simulator/start", { chatId, name });
    setStarted(true);
    setMessages([{ id: "start", from: "bot", text: reply.text, buttons: reply.buttons }]);
  }

  async function click(button: Button) {
    setMessages((prev) => [...prev, { id: `me-${Date.now()}`, from: "me", text: button.label }]);
    const reply = await api.post<{ text: string; buttons?: Button[] }>("/api/simulator/click", { chatId, buttonId: button.id });
    setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, from: "bot", text: reply.text, buttons: reply.buttons }]);
  }

  async function send() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: `me-${Date.now()}`, from: "me", text }]);
    const reply = await api.post<{ text: string; buttons?: Button[] }>("/api/simulator/message", { chatId, text, name });
    setMessages((prev) => [...prev, { id: `bot-${Date.now()}`, from: "bot", text: reply.text, buttons: reply.buttons }]);
  }

  async function rate(answerId: string, rating: "HELPFUL" | "NOT_HELPFUL" | "RESOLVED") {
    await api.post(`/api/answers/${answerId}/rate`, { rating });
    setPendingRatings((p) => ({ ...p, [answerId]: false }));
  }

  if (!started) {
    return (
      <div className="panel simulator-intro">
        <h2>Чат-симулятор AskVUZ</h2>
        <p className="muted">
          Здесь можно пройти основной пользовательский сценарий так же, как он выглядел бы в МАХ, без необходимости
          подключать реальный токен бота. Логика (выбор вуза → категория → вопрос → маршрутизация эксперту → ответ в
          реальном времени) — общая с реальной интеграцией в src/max/webhook.ts.
        </p>
        <label>
          Ваше имя
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button onClick={start}>Начать чат</button>
      </div>
    );
  }

  return (
    <div className="panel chat-panel">
      <h2>Чат-симулятор AskVUZ</h2>
      <div className="chat-window">
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble chat-bubble--${m.from}`}>
            <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
            {m.buttons && (
              <div className="chat-bubble__buttons">
                {m.buttons.map((b) => (
                  <button key={b.id} onClick={() => click(b)}>
                    {b.label}
                  </button>
                ))}
              </div>
            )}
            {m.id.startsWith("ans-") && pendingRatings[m.id.replace("ans-", "")] && (
              <div className="chat-bubble__rate">
                <span>Оцените ответ:</span>
                <button onClick={() => rate(m.id.replace("ans-", ""), "RESOLVED")}>Решило вопрос ✅</button>
                <button onClick={() => rate(m.id.replace("ans-", ""), "HELPFUL")}>Помогло 👍</button>
                <button onClick={() => rate(m.id.replace("ans-", ""), "NOT_HELPFUL")}>Не помогло 👎</button>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input">
        <input
          placeholder="Напишите сообщение…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send}>Отправить</button>
      </div>
    </div>
  );
}
