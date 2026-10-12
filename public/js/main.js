import { streamChat } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { createReveal } from "./reveal.js";
import { loadHistory, saveHistory, clearHistory } from "./store.js";
import * as ui from "./ui.js";

const { els } = ui;
const isTouch = matchMedia("(pointer: coarse)").matches;

let history = loadHistory();
let busy = false;
let controller = null;
let reveal = null;
let notice = null;
let chatId = 0; // changes on "New chat" so a late reply can never leak into the new chat

function removeNotice() {
  notice?.remove();
  notice = null;
}

function renderHistory() {
  ui.clearMessages();
  for (const m of history) {
    const isBot = m.role === "assistant";
    const { root, body } = ui.addMessage(isBot ? "bot" : "user", m.content);
    if (isBot) {
      renderMarkdown(body, m.content);
      ui.enhanceCodeBlocks(body);
      ui.addBotActions(root, () => m.content);
    }
  }
  ui.scrollToBottom();
  ui.updateJumpButton();
}

async function send(text) {
  const id = chatId;
  removeNotice();

  const userMsg = ui.addMessage("user", text);
  history.push({ role: "user", content: text });

  busy = true;
  ui.setBusy(true);
  controller = new AbortController();

  const bot = ui.addMessage("bot");
  ui.showThinking(bot.body);
  ui.scrollToBottom();

  let reply = "";
  reveal = createReveal({
    onRender: (shownText) => {
      const stick = ui.nearBottom();
      renderMarkdown(bot.body, shownText);
      if (stick) ui.scrollToBottom();
    },
  });

  // Undo this turn: remove it from the screen and history, give the text back to the user.
  const undoTurn = () => {
    bot.root.remove();
    userMsg.root.remove();
    history.pop();
    els.input.value = text;
    ui.autoGrow();
    if (!history.length) ui.setEmpty(true);
  };

  // Keep the reply: final render, copy buttons, save to history.
  const commitReply = () => {
    renderMarkdown(bot.body, reply);
    ui.enhanceCodeBlocks(bot.body);
    ui.addBotActions(bot.root, () => reply);
    history.push({ role: "assistant", content: reply });
    saveHistory(history);
  };

  try {
    await streamChat({
      messages: history,
      signal: controller.signal,
      onDelta: (delta) => {
        reply += delta;
        reveal.push(delta);
      },
    });
    await reveal.finish();
    if (id !== chatId) return;
    if (!reply) throw new Error("The reply was empty. Please try again.");
    commitReply();
  } catch (err) {
    if (id !== chatId) return; // the chat was reset meanwhile: leave the new chat alone
    if (err.name === "AbortError") {
      // The user pressed Stop.
      reveal.flush();
      if (reply) commitReply();
      else undoTurn();
    } else {
      reveal.cancel();
      undoTurn();
      notice = ui.showNotice(err.message || "Something went wrong. Please try again.");
    }
  } finally {
    if (id === chatId) {
      busy = false;
      controller = null;
      reveal = null;
      ui.setBusy(false);
      ui.scrollToBottom();
      if (!isTouch) els.input.focus();
    }
  }
}

/* ---------- events ---------- */
els.composer.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) {
    controller?.abort(); // the send button is a Stop button while generating
    reveal?.flush();
    return;
  }
  const text = els.input.value.trim();
  if (!text) return;
  els.input.value = "";
  ui.autoGrow();
  send(text);
});

els.input.addEventListener("input", () => {
  ui.autoGrow();
  ui.updateSendState(busy);
});

els.input.addEventListener("keydown", (e) => {
  // Desktop: Enter sends, Shift+Enter adds a line. Touch devices: Enter adds a line.
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !isTouch) {
    e.preventDefault();
    els.composer.requestSubmit();
  }
});

els.log.addEventListener("scroll", ui.updateJumpButton, { passive: true });
els.jump.addEventListener("click", () => ui.scrollToBottom(true));

els.newChat.addEventListener("click", () => {
  chatId += 1;
  controller?.abort();
  reveal?.cancel();
  controller = null;
  reveal = null;
  busy = false;
  history = [];
  clearHistory();
  removeNotice();
  ui.clearMessages();
  ui.setBusy(false);
  els.input.focus();
});

renderHistory();
ui.setBusy(false);
