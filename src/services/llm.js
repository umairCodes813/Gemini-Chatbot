import { config } from "../config.js";
import { mockStream } from "./mock.js";
import { buildSystemPrompt } from "../utils/prompt.js";

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Options from richest to simplest. If Gemini rejects a request (HTTP 400)
// we step down one level, for example dropping "thinking".
function levelsFor(wantSearch) {
  return wantSearch
    ? [
        { search: true, thinking: true },
        { search: true, thinking: false },
      ]
    : [
        { search: false, thinking: true },
        { search: false, thinking: false },
      ];
}

function buildBody(history, tz, level) {
  const generationConfig = { maxOutputTokens: config.maxTokens };
  if (level.thinking && config.thinkingLevel) {
    generationConfig.thinkingConfig = { thinkingLevel: config.thinkingLevel };
  }

  const body = {
    systemInstruction: {
      parts: [
        {
          text: buildSystemPrompt(tz, {
            search: level.search,
            always: config.webSearch === "always",
          }),
        },
      ],
    },
    // Gemini uses "model" where OpenAI uses "assistant".
    contents: history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig,
  };

  if (level.search) body.tools = [{ googleSearch: {} }];
  return body;
}

// Turns one streamed Gemini payload into the same shape the router already reads.
// "thought" parts are the model thinking out loud: they must never reach the chat.
function parseChunk(json) {
  const candidate = json.candidates?.[0];
  if (!candidate) return null;

  const text = (candidate.content?.parts ?? [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");

  const finish = candidate.finishReason;
  if (!text && !finish) return null;

  return {
    choices: [
      {
        delta: { content: text },
        // The router adds a "say continue" note when a reply is cut off.
        finish_reason: finish === "MAX_TOKENS" ? "length" : finish ? "stop" : null,
      },
    ],
  };
}

// Reads Gemini's server-sent events and yields normalised chunks.
function readStream(body, controller) {
  const decoder = new TextDecoder();
  let buffer = "";

  async function* generate() {
    for await (const bytes of body) {
      buffer += decoder.decode(bytes, { stream: true });
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        let json;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }
        const chunk = parseChunk(json);
        if (chunk) yield chunk;
      }
    }
  }

  const iterator = generate();
  return { controller, [Symbol.asyncIterator]: () => iterator };
}

async function startStream(model, history, tz, level) {
  if (config.mock) return mockStream();

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  let response;
  try {
    response = await fetch(
      `${API_ROOT}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey,
        },
        body: JSON.stringify(buildBody(history, tz, level)),
        signal: controller.signal,
      }
    );
  } catch (err) {
    clearTimeout(connectTimer);
    if (controller.signal.aborted) {
      const timeout = new Error("The AI service did not answer in time.");
      timeout.name = "APIConnectionTimeoutError";
      throw timeout;
    }
    throw err;
  }
  clearTimeout(connectTimer);

  if (!response.ok) {
    let info = {};
    try {
      info = (await response.json())?.error ?? {};
    } catch {
      // The error body was not JSON; fall back to a generic message.
    }
    const err = new Error(info.message || `The AI service returned ${response.status}.`);
    err.status = response.status;
    throw err;
  }

  return readStream(response.body, controller);
}

// Gemini limits are per model, and Google Search grounding is often unavailable
// on free plans. Both are remembered briefly so the next message skips them
// instead of retrying a dead option on every request.
const MOVE_ON_STATUSES = [400, 403, 404, 413, 429, 500, 502, 503];
const MODEL_COOLDOWN_MS = 2 * 60_000;
const SEARCH_COOLDOWN_MS = 15 * 60_000;

const modelCooldownUntil = new Map();
let searchPausedUntil = 0;

const cooling = (model) => (modelCooldownUntil.get(model) ?? 0) > Date.now();

function attempt(model, history, tz, wantSearch) {
  const levels = levelsFor(wantSearch);
  let step = 0;
  let retried = false;

  return (async () => {
    while (true) {
      try {
        return await startStream(model, history, tz, levels[step]);
      } catch (err) {
        // Rejected options (HTTP 400): retry with simpler settings.
        if (err.status === 400 && step < levels.length - 1) {
          console.warn("Gemini rejected some options. Retrying with simpler settings.");
          step += 1;
          continue;
        }
        // Temporary failure: retry once after a short pause.
        const timedOut = err.name === "APIConnectionTimeoutError";
        const temporary = (err.status === undefined && !timedOut) || err.status >= 500;
        if (temporary && !retried) {
          retried = true;
          await sleep(400);
          continue;
        }
        throw err;
      }
    }
  })();
}

export async function openChatStream({ history, tz, search = true }) {
  const models = [...new Set([config.model, config.fallbackModel].filter(Boolean))];
  // Ready models first; ones in cooldown are kept as a last resort.
  models.sort((a, b) => Number(cooling(a)) - Number(cooling(b)));

  const searchAllowed = config.webSearch !== "off" && Date.now() >= searchPausedUntil;
  const wantSearch = search && searchAllowed;

  const plan = [];
  if (wantSearch) for (const model of models) plan.push({ model, search: true });
  for (const model of models) plan.push({ model, search: false });

  let lastError;
  let searchFailedOnce = false;

  for (const entry of plan) {
    // Reaching a no-search attempt means every search attempt failed.
    if (wantSearch && !entry.search && !searchFailedOnce) {
      searchFailedOnce = true;
      searchPausedUntil = Date.now() + SEARCH_COOLDOWN_MS;
      console.warn("Web search is unavailable right now; continuing without it.");
    }

    try {
      return await attempt(entry.model, history, tz, entry.search);
    } catch (err) {
      lastError = err;
      // A failure while searching may just mean grounding is unavailable, so
      // only cool the model when the plain (no-search) request also fails.
      if (!entry.search && [403, 404, 429].includes(err.status)) {
        modelCooldownUntil.set(entry.model, Date.now() + MODEL_COOLDOWN_MS);
      }
      if (!MOVE_ON_STATUSES.includes(err.status)) throw err;
      console.warn(
        `${entry.model}${entry.search ? " (search)" : ""} failed (${err.status}). Trying the next option.`
      );
    }
  }

  throw lastError;
}
