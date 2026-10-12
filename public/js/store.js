// Keeps the conversation in localStorage so a page refresh does not lose it.
const KEY = "chat.history.v1";
const MAX_SAVED = 100;

export function loadHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data.filter(
      (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    );
  } catch {
    return [];
  }
}

export function saveHistory(history) {
  try {
    localStorage.setItem(KEY, JSON.stringify(history.slice(-MAX_SAVED)));
  } catch {
    /* storage unavailable: the chat still works, it just will not persist */
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
