import { Router } from "express";
import { config } from "../config.js";
import { openChatStream } from "../services/llm.js";
import { toClientError } from "../utils/errors.js";

export const chatRouter = Router();

const LENGTH_NOTE =
  '\n\n*The reply reached the length limit. Say "continue" to get the rest.*';

function isValid(m) {
  return (
    m &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.trim() !== ""
  );
}

// Keep the newest messages that fit the budget; the history must start with a user turn.
function prepareHistory(messages) {
  if (!Array.isArray(messages)) return [];
  const valid = messages
    .filter(isValid)
    .map((m) => ({ role: m.role, content: m.content.slice(0, config.maxMessageChars) }))
    .slice(-config.maxHistoryMessages);

  const kept = [];
  let total = 0;
  for (let i = valid.length - 1; i >= 0; i--) {
    total += valid[i].content.length;
    if (total > config.maxHistoryChars && kept.length > 0) break;
    kept.unshift(valid[i]);
  }
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}

chatRouter.post("/chat", async (req, res) => {
  const { messages, tz } = req.body ?? {};
  const history = prepareHistory(messages);
  if (history.length === 0) {
    return res.status(400).json({ error: "Send at least one message." });
  }

  // Open the event stream immediately: a slow answer (web search) keeps the connection alive
  // with small pings instead of leaving the browser waiting in silence.
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  let closed = false;
  let active = null;
  let sentText = false;

  // Stop paying for tokens if the browser disconnects or the user presses Stop.
  res.on("close", () => {
    closed = true;
    active?.controller?.abort();
  });

  const send = (data) => {
    if (!closed && !res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const keepAlive = setInterval(() => {
    if (!closed && !res.writableEnded) res.write(": ping\n\n");
  }, 10_000);

  // Streams one reply to the browser. Returns how many characters were sent.
  async function relay(search) {
    const stream = await openChatStream({ history, tz, search });
    active = stream;
    if (closed) {
      stream.controller?.abort();
      return 0;
    }

    let chars = 0;
    let finishReason = null;
    let idleTimer;
    const watch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => stream.controller?.abort(), config.streamIdleMs);
    };
    const emit = (text) => {
      if (!text) return;
      send({ delta: text });
      chars += text.length;
      sentText = true;
    };

    watch();
    try {
      for await (const chunk of stream) {
        watch();
        const choice = chunk.choices?.[0];
        emit(choice?.delta?.content ?? "");
        if (choice?.finish_reason) finishReason = choice.finish_reason;
      }
    } finally {
      clearTimeout(idleTimer);
    }
    if (chars > 0 && finishReason === "length") send({ delta: LENGTH_NOTE });
    return chars;
  }

  try {
    let chars = await relay(true);
    if (chars === 0 && !closed && config.webSearch !== "off") {
      console.warn("Empty reply while web search was on. Retrying without it.");
      chars = await relay(false);
    }
    if (!closed) res.write("data: [DONE]\n\n");
  } catch (err) {
    if (!closed) {
      console.error("Chat error:", err.status ?? "", err.message);
      const message = sentText
        ? "The response was interrupted. Please try again."
        : toClientError(err).message;
      send({ error: message });
    }
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});
