const URL_PATTERN = /https?:\/\/|www\.\S+/gi;
const BANNED_SUBSTRINGS = [
  "идиот",
  "дебил",
  "казино",
  "ставки на спорт",
  "заработок без вложений",
];

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

export function moderateQuestionText(text: string): ModerationResult {
  const trimmed = text.trim();

  if (trimmed.length < 3) {
    return { ok: false, reason: "Вопрос слишком короткий — опишите, пожалуйста, подробнее, в чём нужна помощь." };
  }
  if (trimmed.length > 2000) {
    return { ok: false, reason: "Вопрос слишком длинный (максимум 2000 символов). Сформулируйте покороче." };
  }

  if (/(.)\1{14,}/u.test(trimmed)) {
    return { ok: false, reason: "Похоже на спам-сообщение. Пожалуйста, напишите обычный вопрос." };
  }

  const urlMatches = trimmed.match(URL_PATTERN);
  if (urlMatches && urlMatches.length >= 2) {
    return { ok: false, reason: "Вопросы со ссылками на несколько сайтов не принимаются — опишите вопрос текстом." };
  }

  const lower = trimmed.toLowerCase();
  if (BANNED_SUBSTRINGS.some((word) => lower.includes(word))) {
    return { ok: false, reason: "Сообщение отклонено модерацией — используйте корректные формулировки." };
  }

  return { ok: true };
}
