/**
 * A deliberately small first line of defence against spam/junk questions,
 * added per user feedback ("эксперты будут получать спам"). This is NOT a
 * full anti-abuse system — no ML classifier, no rate limiting across
 * accounts, no persistent ban list — just cheap, explainable checks that
 * catch the obvious cases (empty/garbage text, link-dumping, keyboard-mash
 * flooding, a short list of slurs/profanity) before a message reaches an
 * expert's inbox.
 *
 * A real product would add: a per-student rate limit (e.g. N open questions
 * per hour), a moderator "block student" action exposed in the admin panel,
 * and a shared blacklist of banned students — tracked as a follow-up in the
 * README, since it needs its own DB table (banned_students) and admin UI.
 */

const URL_PATTERN = /https?:\/\/|www\.\S+/gi;
const BANNED_SUBSTRINGS = [
  // Intentionally short and mild — just enough to demonstrate the filter
  // exists; a real deployment would use a maintained profanity list.
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

  // "aaaaaaaaaaaaaaaa" / "!!!!!!!!!!!!!!!!" style keyboard-mash flooding.
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
