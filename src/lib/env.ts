import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const isProduction = process.env.NODE_ENV === "production";

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    const value = process.env.AUTH_SECRET;
    if (value) return value;
    if (isProduction) throw new Error("Missing required environment variable: AUTH_SECRET");
    return "dev-only-insecure-auth-secret-change-me";
  },
  get encryptionKey() {
    const value = process.env.ENCRYPTION_KEY;
    if (value) return value;
    if (isProduction) throw new Error("Missing required environment variable: ENCRYPTION_KEY");
    // Development fallback. Never used in production.
    return "dev-only-insecure-encryption-key-change-me";
  },
  get appUrl() {
    return optional("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get adminEmail() {
    return optional("ADMIN_EMAIL").toLowerCase();
  },
  get defaultProvider() {
    return optional("DEFAULT_LLM_PROVIDER", "openai");
  },
  get defaultApiKey() {
    return optional("DEFAULT_LLM_API_KEY");
  },
  get defaultModel() {
    return optional("DEFAULT_LLM_MODEL", "gpt-4o-mini");
  },
  get defaultBaseUrl() {
    return optional("DEFAULT_LLM_BASE_URL").replace(/\/$/, "");
  },
  get freeGenerationsPerDay() {
    return Number(optional("FREE_GENERATIONS_PER_DAY", "5")) || 5;
  },
  get smtpHost() {
    return optional("SMTP_HOST");
  },
  get smtpPort() {
    return Number(optional("SMTP_PORT", "587")) || 587;
  },
  get smtpUser() {
    return optional("SMTP_USER");
  },
  get smtpPassword() {
    return optional("SMTP_PASSWORD");
  },
  get mailFrom() {
    return optional("MAIL_FROM", "CV Studio <no-reply@localhost>");
  },
  get allowOpenSignup() {
    return optional("ALLOW_OPEN_SIGNUP", "false") === "true";
  },
};
