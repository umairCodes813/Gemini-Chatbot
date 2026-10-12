// All DOM work lives here. main.js decides *what* happens, ui.js decides *how it looks*.
const $ = (id) => document.getElementById(id);

export const els = {
  log: $("log"),
  empty: $("empty"),
  messages: $("messages"),
  jump: $("jump"),
  input: $("input"),
  send: $("send"),
  composer: $("composer"),
  newChat: $("new-chat"),
};

const ICON_SEND =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const ICON_STOP =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';

/* ---------- scrolling ---------- */
export function nearBottom() {
  const { scrollTop, scrollHeight, clientHeight } = els.log;
  return scrollHeight - scrollTop - clientHeight < 80;
}

export function scrollToBottom(smooth = false) {
  els.log.scrollTo({ top: els.log.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

export function updateJumpButton() {
  els.jump.hidden = nearBottom();
}

/* ---------- messages ---------- */
export function setEmpty(isEmpty) {
  els.empty.hidden = !isEmpty;
}

export function clearMessages() {
  els.messages.replaceChildren();
  setEmpty(true);
}

export function addMessage(role, text = "") {
  setEmpty(false);
  const root = document.createElement("article");
  root.className = `msg ${role}`;
  const body = document.createElement("div");
  body.className = "body";
  body.dir = "auto";
  if (role === "user") body.textContent = text;
  root.append(body);
  els.messages.append(root);
  return { root, body };
}

export function showThinking(body) {
  body.innerHTML =
    '<span class="dots" role="status" aria-label="Gemini is typing"><i></i><i></i><i></i></span>';
  // Slow answers (for example while searching the web): tell the user it is still working.
  setTimeout(() => {
    if (!body.querySelector(".dots") || body.querySelector(".wait")) return;
    const hint = document.createElement("span");
    hint.className = "wait";
    hint.textContent = "Working on it. This can take a few seconds…";
    body.append(hint);
  }, 4000);
}

function textButton(label, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-text";
  btn.textContent = label;
  btn.addEventListener("click", () => onClick(btn));
  return btn;
}

async function copyText(btn, text) {
  const original = btn.dataset.label ?? btn.textContent;
  btn.dataset.label = original;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "Copied";
  } catch {
    btn.textContent = "Copy failed";
  }
  setTimeout(() => (btn.textContent = original), 1500);
}

export function addBotActions(root, getText) {
  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(textButton("Copy", (btn) => copyText(btn, getText())));
  root.append(actions);
}

export function enhanceCodeBlocks(body) {
  body.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".copy")) return;
    const btn = textButton("Copy", (b) => copyText(b, pre.querySelector("code")?.textContent ?? ""));
    btn.classList.add("copy");
    pre.append(btn);
  });
}

export function showNotice(message) {
  const el = document.createElement("div");
  el.className = "notice";
  el.setAttribute("role", "alert");
  el.textContent = message;
  els.messages.append(el);
  return el;
}

/* ---------- composer ---------- */
export function autoGrow() {
  els.input.style.height = "auto";
  els.input.style.height = `${els.input.scrollHeight}px`;
}

export function updateSendState(busy) {
  els.send.disabled = !busy && !els.input.value.trim();
}

export function setBusy(busy) {
  els.log.setAttribute("aria-busy", String(busy)); // screen readers wait until the reply is complete
  els.send.innerHTML = busy ? ICON_STOP : ICON_SEND;
  els.send.setAttribute("aria-label", busy ? "Stop generating" : "Send message");
  updateSendState(busy);
}
