// Sends the conversation to our server and reads the streamed reply.
const IDLE_LIMIT_MS = 75_000; // give up if nothing at all arrives for this long

export async function streamChat({ messages, signal, onDelta }) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  const inner = new AbortController();
  let timedOut = false;
  let timer = 0;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      inner.abort();
    }, IDLE_LIMIT_MS);
  };
  const forwardAbort = () => inner.abort();
  signal.addEventListener("abort", forwardAbort, { once: true });

  try {
    arm();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      signal: inner.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Request failed. Please try again.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      arm();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop();

      for (const event of events) {
        if (!event.startsWith("data: ")) continue; // ignore keep-alive comments
        const payload = event.slice(6);
        if (payload === "[DONE]") return;
        const msg = JSON.parse(payload);
        if (msg.error) throw new Error(msg.error);
        onDelta(msg.delta);
      }
    }
  } catch (err) {
    if (timedOut) throw new Error("The server took too long to respond. Please try again.");
    if (err.name === "AbortError") throw err;
    if (err instanceof TypeError) throw new Error("Cannot reach the server. Check your connection.");
    throw err;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", forwardAbort);
  }
}
