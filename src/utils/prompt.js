const CORE =
  "You are a clear, honest and concise assistant. " +
  "Use Markdown only when it helps (short lists, code blocks). " +
  "Reply in the language the user writes in, including Urdu and Roman Urdu. " +
  "If you are not sure, say so instead of guessing. " +
  "Do not state a knowledge cutoff year.";

const WITH_SEARCH =
  "You can search the web with Google. For anything that may have changed recently " +
  "(news, prices, rates, scores, releases, 'latest', 'current', 'today'), " +
  "search first and answer from the results, naming the source in one short line. " +
  "For stable knowledge, answer directly without searching.";

const ALWAYS_SEARCH =
  "Always search the web with Google before answering, and name the source " +
  "in one short line.";

const WITHOUT_SEARCH =
  "You cannot browse the internet. For anything that may have changed recently, " +
  "say that you cannot verify it live and answer with what you know.";

function validZone(tz) {
  if (typeof tz !== "string" || tz.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function buildSystemPrompt(tz, { search = false, always = false } = {}) {
  const zone = validZone(tz);
  const now = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: zone,
  }).format(new Date());
  const mode = search ? (always ? ALWAYS_SEARCH : WITH_SEARCH) : WITHOUT_SEARCH;
  return (
    `${CORE} ${mode}\n\n` +
    `Current date and time: ${now} (${zone}). ` +
    "This is correct and overrides your training data for questions about today's date."
  );
}
