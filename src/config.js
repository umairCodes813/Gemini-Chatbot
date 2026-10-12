import "dotenv/config";

const env = (name) => process.env[name]?.trim() ?? "";

function required(name) {
  const value = env(name);
  if (!value || value === "PASTE_YOUR_API_KEY_HERE") {
    console.error(`Missing ${name}. Open your .env file and fill it in.`);
    process.exit(1);
  }
  return value;
}

const mock = env("MOCK_LLM").toLowerCase() === "true";
const searchSetting = env("WEB_SEARCH").toLowerCase();
const webSearch = ["auto", "always"].includes(searchSetting) ? searchSetting : "off";

// Gemini "thinking" level: "low" keeps replies fast, "high" thinks more.
// Empty or unknown values leave the setting out of the request.
const levelRaw = env("THINKING_LEVEL").toLowerCase();
const thinkingLevel = ["low", "high"].includes(levelRaw) ? levelRaw : null;

export const config = {
  mock,
  port: Number(env("PORT")) || 3000,
  apiKey: mock ? "mock" : required("GEMINI_API_KEY"),
  model: mock ? "mock" : required("MODEL"),
  fallbackModel: env("FALLBACK_MODEL"),
  thinkingLevel,
  maxTokens: Number(env("MAX_TOKENS")) || 1500,
  // Keep requests small: free plans have a tokens-per-minute limit.
  maxHistoryMessages: 20,
  maxHistoryChars: Number(env("HISTORY_CHARS")) || 8000,
  maxMessageChars: 4000,
  // Web search: "off", "auto" (the model decides) or "always".
  webSearch,
  // How long to wait for the connection before giving up.
  requestTimeoutMs: 45_000,
  // Stop a stalled answer (no data received for this long).
  streamIdleMs: 90_000,
};
