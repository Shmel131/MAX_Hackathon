import "dotenv/config";

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
  corsOrigin: process.env.CORS_ORIGIN || "*",

  adminEmail: process.env.ADMIN_EMAIL || "admin@askvuz.local",
  adminPassword: process.env.ADMIN_PASSWORD || "admin12345",

  mockMax: envBool("MOCK_MAX", true),
  maxBotToken: process.env.MAX_BOT_TOKEN || "",
  maxApiBaseUrl: process.env.MAX_API_BASE_URL || "https://botapi.max.ru",
  maxWebhookSecret: process.env.MAX_WEBHOOK_SECRET || "",

  fastResponseThresholdSeconds: parseInt(process.env.FAST_RESPONSE_THRESHOLD_SECONDS || "300", 10),
};
